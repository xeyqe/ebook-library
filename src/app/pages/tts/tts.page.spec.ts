import { vi } from 'vitest';
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
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TTS playback integration', () => {
  let page: any;
  let reader: any;
  let database: any;
  let playback: ReturnType<typeof deferred>;
  let listeners: Record<string, (event: any) => void>;
  let removeProgress: ReturnType<typeof vi.fn>;
  let removeFocus: ReturnType<typeof vi.fn>;

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await page.speechOperation;
  }

  beforeEach(() => {
    // jsdom does not implement the Screen Orientation API.
    vi.stubGlobal('screen', { orientation: { type: 'portrait-primary' } });
    playback = deferred();
    listeners = {};
    removeProgress = vi.fn().mockResolvedValue(undefined);
    removeFocus = vi.fn().mockResolvedValue(undefined);
    reader = {
      read: vi.fn().mockImplementation(() => playback.promise),
      stop: vi.fn().mockResolvedValue(undefined),
      requestFocus: vi.fn().mockResolvedValue(undefined),
      abandonFocus: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockImplementation(async (name, callback) => {
        listeners[name] = callback;
        return { remove: name === 'progressArrayEvent' ? removeProgress : removeFocus };
      }),
      getDefaults: vi.fn().mockResolvedValue({
        engine: 'default',
        language: 'en-US',
        voiceURI: 'default-voice',
      }),
      getSupportedEngines: vi.fn().mockResolvedValue({
        engines: [{ name: 'default' }, { name: 'saved-engine' }],
      }),
      getSupportedLanguages: vi.fn().mockResolvedValue({ languages: ['en-US'] }),
      getSupportedVoices: vi.fn().mockResolvedValue({
        voices: [{ lang: 'en-US', voiceURI: 'selected-voice', name: 'Selected' }],
      }),
      getMaxSpeechInputLength: vi.fn().mockResolvedValue({ maxSpeechInputLength: 4000 }),
      switchEngine: vi.fn().mockResolvedValue(undefined),
    };
    database = {
      getValue: vi.fn().mockResolvedValue(null),
      getBook: vi.fn().mockResolvedValue({ progress: '0/2' }),
      saveValue: vi.fn().mockResolvedValue(undefined),
      updateBookLastRead: vi.fn().mockResolvedValue(undefined),
      updateBookProgress: vi.fn().mockResolvedValue(undefined),
      updateBookFinished: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: TTS_PLUGIN, useValue: reader },
        { provide: DatabaseService, useValue: database },
        { provide: DirectoryService, useValue: {} },
        { provide: EpubService, useValue: {} },
        { provide: FileReaderService, useValue: {} },
        { provide: Platform, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: Storage, useValue: { set: () => Promise.resolve() } },
        BusyService,
      ],
    });
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('advances spritz progress after displaying a sentence', async () => {
    page.spritzState.isSpritz = true;
    page.speechState.isSpeaking = true;
    vi.spyOn(page, 'wait').mockResolvedValue(undefined);
    await page.spritz();
    expect(page.progress()).toBe(2);
  });

  it('registers progress before reading and passes the selected string voice and book', async () => {
    await page.onOff();
    expect(reader.addListener.mock.calls[0][0]).toBe('progressArrayEvent');
    expect(reader.addListener.mock.invocationCallOrder[0]).toBeLessThan(reader.read.mock.invocationCallOrder[0]);
    expect(reader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceURI: 'selected-voice',
        bookId: 42,
        progress: 0,
        texts: page.texts,
      }),
    );
    listeners['progressArrayEvent']({ progress: 0 });
    expect(page.progress()).toBe(1);
  });

  it('stops reading, releases focus and restores the native background checkpoint', async () => {
    await page.onOff();
    database.getBook.mockResolvedValue({ progress: '2/2' });
    await page.onOff();
    expect(reader.stop).toHaveBeenCalledTimes(1);
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
    expect(removeProgress).toHaveBeenCalledTimes(1);
    expect(page.progress()).toBe(2);
    expect(page.speechState.isSpeaking).toBe(false);
    expect(page.readingCompleted).toBe(false);
  });

  it('ignores an old completion after restarting playback', async () => {
    const oldPlayback = playback;
    await page.onOff();
    await page.onOff();
    playback = deferred();
    await page.onOff();
    oldPlayback.resolve();
    await settle();
    expect(page.speechState.isSpeaking).toBe(true);
    expect(page.working.isSpeaking).toBe(true);
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
  });

  it('cleans up after a native playback error and exposes the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await page.onOff();
    playback.reject(new Error('Unable to start background reading'));
    await settle();
    expect(page.speechError).toBe('Unable to start background reading');
    expect(page.speechState.isSpeaking).toBe(false);
    expect(removeProgress).toHaveBeenCalled();
    expect(reader.abandonFocus).toHaveBeenCalled();
  });

  it('loads saved engine and voice settings before enabling playback', async () => {
    database.getValue.mockResolvedValue(
      JSON.stringify({
        engine: 'saved-engine',
        language: 'en-US',
        voice: 'selected-voice',
      }),
    );
    await page.initSpeechOptions();
    expect(reader.switchEngine).toHaveBeenCalledWith({ engineName: 'saved-engine' });
    expect(page.speechForm.controls.voice.value).toBe('selected-voice');
    expect(page.speechReady).toBe(true);
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
    expect(page.readingCompleted).toBe(true);
    expect(page.progress()).toBe(2);
    expect(page.speechState.isSpeaking).toBe(false);
    expect(removeProgress).toHaveBeenCalledTimes(1);
    expect(reader.abandonFocus).toHaveBeenCalledTimes(1);
  });
});
