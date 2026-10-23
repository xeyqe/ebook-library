import { TestBed } from '@angular/core/testing';
import { TtsComponent } from './tts.page';
import { TTS_PLUGIN } from 'src/app/services/tts-plugin';
import { ActivatedRoute } from '@angular/router';
import { Storage } from '@ionic/storage-angular';
import { Platform } from '@ionic/angular/lazy';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { EpubService } from 'src/app/services/epub.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { BusyService } from 'src/app/services/busy.service';

function deferred() {
  let resolve: () => void;
  let reject: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('TTS playback integration', () => {
  let page: any;
  let reader: any;
  let database: any;
  let playback: ReturnType<typeof deferred>;
  let listeners: Record<string, (event: any) => void>;
  let removeProgress: jasmine.Spy;
  let removeFocus: jasmine.Spy;

  async function settle() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await page.speechOperation;
  }

  beforeEach(() => {
    playback = deferred();
    listeners = {};
    removeProgress = jasmine.createSpy('removeProgress').and.resolveTo();
    removeFocus = jasmine.createSpy('removeFocus').and.resolveTo();
    reader = {
      read: jasmine.createSpy('read').and.callFake(() => playback.promise),
      stop: jasmine.createSpy('stop').and.resolveTo(),
      requestFocus: jasmine.createSpy('requestFocus').and.resolveTo(),
      abandonFocus: jasmine.createSpy('abandonFocus').and.resolveTo(),
      addListener: jasmine.createSpy('addListener').and.callFake(async (name, callback) => {
        listeners[name] = callback;
        return { remove: name === 'progressArrayEvent' ? removeProgress : removeFocus };
      }),
      getDefaults: jasmine.createSpy('getDefaults').and.resolveTo({
        engine: 'default', language: 'en-US', voiceURI: 'default-voice',
      }),
      getSupportedEngines: jasmine.createSpy('getSupportedEngines').and.resolveTo({
        engines: [{ name: 'default' }, { name: 'saved-engine' }],
      }),
      getSupportedLanguages: jasmine.createSpy('getSupportedLanguages').and.resolveTo({ languages: ['en-US'] }),
      getSupportedVoices: jasmine.createSpy('getSupportedVoices').and.resolveTo({
        voices: [{ lang: 'en-US', voiceURI: 'selected-voice', name: 'Selected' }],
      }),
      getMaxSpeechInputLength: jasmine.createSpy('getMaxSpeechInputLength').and.resolveTo({ maxSpeechInputLength: 4000 }),
      switchEngine: jasmine.createSpy('switchEngine').and.resolveTo(),
    };
    database = {
      getValue: jasmine.createSpy('getValue').and.resolveTo(null),
      getBook: jasmine.createSpy('getBook').and.resolveTo({ progress: '0/2' }),
      saveValue: jasmine.createSpy('saveValue').and.resolveTo(),
      updateBookLastRead: jasmine.createSpy('updateBookLastRead').and.resolveTo(),
      updateBookProgress: jasmine.createSpy('updateBookProgress').and.resolveTo(),
      updateBookFinished: jasmine.createSpy('updateBookFinished').and.resolveTo(),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: TTS_PLUGIN, useValue: reader },
      { provide: DatabaseService, useValue: database },
      { provide: DirectoryService, useValue: {} },
      { provide: EpubService, useValue: {} },
      { provide: FileReaderService, useValue: {} },
      { provide: Platform, useValue: {} },
      { provide: ActivatedRoute, useValue: {} },
      { provide: Storage, useValue: { set: () => Promise.resolve() } },
      BusyService,
    ] });
    page = TestBed.runInInjectionContext(() => new TtsComponent());
    page.initialized = true;
    page.speechReady = true;
    page.spritzState.isSpritz = false;
    page.speechState.voice = 'selected-voice';
    page.id = 42;
    page.bookId = 42;
    page.texts = ['First.', 'Second.', 'Third.'];
  });

  afterEach(async () => {
    page.ngOnDestroy();
    await settle();
    clearTimeout(page.progressSaveTimer);
  });

  it('advances spritz progress after displaying a sentence', async () => {
    page.spritzState.isSpritz = true;
    page.speechState.isSpeaking = true;
    spyOn(page, 'wait').and.resolveTo();
    await page.spritz();
    expect(page.progress()).toBe(2);
  });

  it('registers progress before reading and passes the selected string voice and book', async () => {
    await page.onOff();
    expect(reader.addListener.calls.first().args[0]).toBe('progressArrayEvent');
    expect(reader.addListener.calls.first().invocationOrder).toBeLessThan(reader.read.calls.first().invocationOrder);
    expect(reader.read).toHaveBeenCalledWith(jasmine.objectContaining({
      voiceURI: 'selected-voice', bookId: 42, progress: 0, texts: page.texts,
    }));
    listeners['progressArrayEvent']({ progress: 0 });
    expect(page.progress()).toBe(1);
  });

  it('stops reading, releases focus and restores the native background checkpoint', async () => {
    await page.onOff();
    database.getBook.and.resolveTo({ progress: '2/2' });
    await page.onOff();
    expect(reader.stop).toHaveBeenCalledTimes(1);
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
    expect(removeProgress).toHaveBeenCalledTimes(1);
    expect(page.progress()).toBe(2);
    expect(page.speechState.isSpeaking).toBeFalse();
    expect(page.readingCompleted).toBeFalse();
  });

  it('ignores an old completion after restarting playback', async () => {
    const oldPlayback = playback;
    await page.onOff();
    await page.onOff();
    playback = deferred();
    await page.onOff();
    oldPlayback.resolve();
    await settle();
    expect(page.speechState.isSpeaking).toBeTrue();
    expect(page.working.isSpeaking).toBeTrue();
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
  });

  it('cleans up after a native playback error and exposes the error', async () => {
    spyOn(console, 'error');
    await page.onOff();
    playback.reject(new Error('Unable to start background reading'));
    await settle();
    expect(page.speechError).toBe('Unable to start background reading');
    expect(page.speechState.isSpeaking).toBeFalse();
    expect(removeProgress).toHaveBeenCalled();
    expect(reader.abandonFocus).toHaveBeenCalled();
  });

  it('loads saved engine and voice settings before enabling playback', async () => {
    database.getValue.and.resolveTo(JSON.stringify({
      engine: 'saved-engine', language: 'en-US', voice: 'selected-voice',
    }));
    await page.initSpeechOptions();
    expect(reader.switchEngine).toHaveBeenCalledWith({ engineName: 'saved-engine' });
    expect(page.speechForm.controls.voice.value).toBe('selected-voice');
    expect(page.speechReady).toBeTrue();
    await page.onOff();
    listeners['audioFocusChangeEvent']({ type: 'AUDIOFOCUS_LOSS' });
    await settle();
    expect(reader.stop).toHaveBeenCalled();
    page.ngOnDestroy();
    expect(removeFocus).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit seek instead of restoring an older native checkpoint', async () => {
    await page.onOff();
    page.progress.set(2);
    await page.stopSpeaking(false);
    expect(page.progress()).toBe(2);
  });

  it('does not roll back progress when the database checkpoint lags behind events', async () => {
    await page.onOff();
    listeners['progressArrayEvent']({ progress: 0 });
    await page.onOff();
    expect(page.progress()).toBe(1);
  });

  it('marks a completed read and releases its listeners and focus', async () => {
    await page.onOff();
    playback.resolve();
    await settle();
    expect(page.readingCompleted).toBeTrue();
    expect(page.progress()).toBe(2);
    expect(page.speechState.isSpeaking).toBeFalse();
    expect(removeProgress).toHaveBeenCalledTimes(1);
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
  });
});
