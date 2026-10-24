import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Capacitor } from '@capacitor/core';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { ReadOptions, TTS_PLUGIN } from 'src/app/services/tts-plugin';
import { Storage } from '@ionic/storage-angular';
import { IonicModule, Platform } from '@ionic/angular/lazy';

import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';

import { filter, firstValueFrom } from 'rxjs';

import { BusyService } from 'src/app/services/busy.service';
import { SpeechPlaybackService } from 'src/app/services/speech-playback.service';
import { EpubService } from 'src/app/services/epub.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';

import { getDocument } from 'pdfjs-dist/build/pdf.mjs';

interface ReadingDetails {
  speed: number;
  title: string;
  authorName: string;
}

interface SpritzState {
  isSpritz: boolean;
  preText: string;
  redText: string;
  postTextWhite: string;
  postTextGray: string;
  sentence: string;
  fontSize: string;
  contHeight: string;
}

interface SpeechState {
  language: string;
  languages: string[];
  voices: Record<string, { voiceURI: string; name: string }[]>;
  voice: string;
  engines: { name: string; label: string; icon: number }[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-tts',
  templateUrl: './tts.page.html',
  styleUrl: './tts.page.scss',
  host: { '(window:orientationchange)': 'onOrientationChange()' },
  imports: [
    DecimalPipe,
    FormsModule,
    IonicModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
    MatSliderModule,
    ReactiveFormsModule,
  ],
})
export class TtsComponent implements OnInit, OnDestroy {
  protected isPortrait = window.screen.orientation.type.startsWith('portrait');
  protected id: number;
  protected texts: string[] = [];
  private readonly playback = inject(SpeechPlaybackService);
  private readonly viewProgress = signal(0);
  private spritzSpeaking = false;

  protected get progress() {
    return !this.spritzState.isSpritz && this.playback.bookId === this.id ? this.playback.progress : this.viewProgress;
  }

  protected get isSpeaking(): boolean {
    return this.spritzState.isSpritz
      ? this.spritzSpeaking
      : this.playback.bookId === this.id && this.playback.isSpeaking();
  }

  protected readonly readingDetails: ReadingDetails = { speed: 30, title: '', authorName: '' };
  protected readonly spritzState: SpritzState = {
    isSpritz: false,
    preText: '',
    redText: '',
    postTextWhite: '',
    postTextGray: '',
    sentence: '',
    fontSize: '20px',
    contHeight: '70px',
  };
  protected readonly speechState: SpeechState = {
    language: '',
    languages: [],
    voices: {},
    voice: '',
    engines: [],
  };

  private path: string;
  private readonly destroyRef = inject(DestroyRef);

  protected initialized = false;

  private isRewinding: boolean;
  private stopRewind: boolean;

  protected speechForm: FormGroup<{
    engine: FormControl<string>;
    language: FormControl<string>;
    voice: FormControl<string>;
  }>;
  private rewindTimer: ReturnType<typeof setTimeout>;
  private progressSaveTimer: ReturnType<typeof setTimeout>;

  private lastReadSet: boolean;
  private readonly tts = inject(TTS_PLUGIN);
  private destroyed = false;
  protected speechReady = false;
  private initializationError = '';
  protected get speechError(): string {
    return this.initializationError || (this.playback.bookId === this.id ? this.playback.error() : '');
  }
  protected readonly speakParams: Pick<ReadOptions, 'rate' | 'pitch' | 'volume' | 'pan'> = {
    rate: 3,
    pitch: 1,
    volume: 1,
    pan: 0,
  };
  protected audioFocus = true;
  private bookId: number;

  private readonly db = inject(DatabaseService);
  private readonly directoryServ = inject(DirectoryService);
  private readonly epubService = inject(EpubService);
  private readonly fs = inject(FileReaderService);
  private readonly platform = inject(Platform);
  private readonly route = inject(ActivatedRoute);
  private readonly strg = inject(Storage);
  private readonly working = inject(BusyService);

  async ngOnInit() {
    this.watchAppResume();
    try {
      await this.loadReadingPreferences();
      await this.loadBook();
      if (!this.spritzState.isSpritz && !this.destroyed) await this.initSpeechOptions();
    } catch (error) {
      this.initializationError = 'Unable to initialize reading. Please try opening this book again.';
      console.error(error);
    } finally {
      this.working.done();
    }
  }

  protected onOrientationChange(): void {
    this.isPortrait = window.screen.orientation.type.startsWith('portrait');
  }

  private watchAppResume() {
    this.platform.resume.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.isSpeaking && !this.spritzState.isSpritz) {
        void this.restoreNativeProgress().catch((error) => console.error(error));
      }
      setTimeout(() => {
        if (!this.destroyed) this.onOrientationChange();
      });
    });
  }

  private async getRouteParams(): Promise<{ id: string; type: 'speech' | 'spritz' }> {
    const params = await firstValueFrom(this.route.paramMap);
    return { id: params.get('id'), type: params.get('type') as 'speech' | 'spritz' };
  }

  private async loadReadingPreferences() {
    try {
      const params = await this.getRouteParams();
      this.id = +params.id;
      this.db.saveValue('as', JSON.stringify({ id: this.id, type: params.type }));

      this.spritzState.isSpritz = params.type === 'spritz';
      if (this.spritzState.isSpritz) {
        this.readingDetails.speed = (await this.strg.get('spritzSpeed')) || 300;
        const val = await this.strg.get('fs');
        if (val) {
          this.spritzState.fontSize = val;
          this.spritzState.contHeight = +val.replace('px', '') * 3 + 10 + 'px';
        }
      } else {
        this.speakParams.rate = (await this.strg.get('speed')) || 3;
      }
    } catch (e) {
      console.error(`loadReadingPreferences failed`);
      console.error(e);
    }
  }

  private async waitTillDbReady(): Promise<boolean> {
    return firstValueFrom(this.db.getDatabaseState().pipe(filter(Boolean)));
  }

  private async loadBook() {
    if (!(await this.waitTillDbReady())) throw new Error('loadBook failed');
    const book = await this.db.getBook(this.id);
    if (!book) throw new Error('Book was not found.');
    this.bookId = book.id;
    this.path = book.path;
    this.readingDetails.title = book.title;

    const progressArray = book.progress?.split('/') || ['0', '0'];
    const existingSession = !this.spritzState.isSpritz && this.playback.bookId === this.id;
    if (!existingSession) this.progress.set(+progressArray[0]);

    this.texts = await this.getTexts();
    if (!existingSession && this.progress() && +progressArray[1] !== this.texts.length - 1) {
      const percents = this.progress() / +progressArray[1];
      this.progress.set(Math.floor((this.texts.length - 1) * percents));
    }
    this.progress.set(Math.max(0, Math.min(this.progress(), Math.max(0, this.texts.length - 1))));
    this.scheduleProgressSave();
    this.working.done();

    const author = await this.db.getAuthor(book.creatorIds[0]);
    this.readingDetails.authorName = [author.name, author.surname].filter((it) => !!it).join(' ') || author.pseudonym;
    this.initialized = true;
  }

  private async getSpeechDefaults() {
    // Binding the service can complete before Android finishes initializing its engine.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.tts.getDefaults();
      } catch (error) {
        if (attempt >= 19 || this.destroyed) throw error;
        await this.wait(100);
      }
    }
  }

  private async initSpeechOptions() {
    const defaults = await this.getSpeechDefaults();
    const saved = await this.db.getValue('tts');
    let settings: { engine?: string; language?: string; voice?: string } = {};
    try {
      settings = saved ? JSON.parse(saved) || {} : {};
    } catch (error) {
      console.error('Unable to load speech settings', error);
    }
    this.speechState.engines = (await this.tts.getSupportedEngines()).engines;
    const engine = this.speechState.engines.some((item) => item.name === settings.engine)
      ? settings.engine
      : defaults.engine;
    if (engine && engine !== defaults.engine) await this.playback.switchEngine(engine);
    await this.loadLanguagesAndVoices();
    const language = this.speechState.languages.includes(settings.language || defaults.language)
      ? settings.language || defaults.language
      : this.speechState.languages[0];
    const voices = this.speechState.voices[language] || [];
    const voice =
      voices.find((item) => item.voiceURI === (settings.voice || defaults.voiceURI))?.voiceURI ||
      voices[0]?.voiceURI ||
      '';
    this.speechState.language = language;
    this.speechState.voice = voice;
    this.speechForm = new FormGroup({
      engine: new FormControl(engine, { nonNullable: true }),
      language: new FormControl(language, { nonNullable: true }),
      voice: new FormControl(voice, { nonNullable: true }),
    });
    if (this.destroyed) return;
    this.watchSpeechSettings();
    this.speechReady = true;
  }

  private watchSpeechSettings(): void {
    this.speechForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.db.saveValue('tts', JSON.stringify(this.speechForm.getRawValue()));
      void this.stopSpeaking();
    });
    this.speechForm.controls.voice.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.speechState.voice = value;
    });
    this.speechForm.controls.language.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.speechState.language = value;
      this.speechForm.controls.voice.setValue(this.speechState.voices[value]?.[0]?.voiceURI || '');
    });
    this.speechForm.controls.engine.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((engineName) => {
      this.switchSpeechEngine(engineName);
    });
  }

  private switchSpeechEngine(engineName: string): void {
    this.speechReady = false;
    void (async () => {
      this.working.busy();
      try {
        await this.playback.switchEngine(engineName);
        await this.loadLanguagesAndVoices();
        const language = this.speechState.languages.includes(this.speechForm.controls.language.value)
          ? this.speechForm.controls.language.value
          : this.speechState.languages[0];
        this.speechForm.controls.language.setValue(language);
        this.initializationError = '';
        this.speechReady = !this.destroyed;
      } finally {
        this.working.done();
      }
    })().catch((error) => this.showSpeechError(error));
  }

  private async loadLanguagesAndVoices() {
    const [languages, voices] = await Promise.all([this.tts.getSupportedLanguages(), this.tts.getSupportedVoices()]);
    this.speechState.languages = languages.languages.sort();
    this.speechState.voices = {};
    for (const voice of voices.voices) {
      (this.speechState.voices[voice.lang] ||= []).push({ voiceURI: voice.voiceURI, name: voice.name });
    }
  }

  private getTexts(): Promise<string[]> {
    this.working.busy();
    const extension = this.path.slice(this.path.lastIndexOf('.') + 1).toLowerCase();
    switch (extension) {
      case 'txt':
        return this.getTextsFromString();
      case 'epub':
        return this.epubService.getText(this.path);
      case 'pdf':
        return this.getTextsFromPdf();
      default:
        throw new Error(`Unsupported book format: ${extension}`);
    }
  }

  private appendSentences(text: string, sentences: string[]): void {
    for (const part of text.split(/(?=[.!?][“"\n\s])|(?<=[.!?][“"\n\s])/)) {
      const lastIndex = sentences.length - 1;
      if (sentences[lastIndex] && part.length < 5) {
        sentences[lastIndex] += part;
      } else {
        sentences.push(part);
      }
    }
  }

  private async getTextsFromString(): Promise<string[]> {
    const sentences: string[] = [];
    this.appendSentences(await this.fs.readTextFile(this.path), sentences);
    return sentences;
  }

  private async getTextsFromPdf(): Promise<string[]> {
    const path = Capacitor.convertFileSrc(this.directoryServ.imgPreLink + this.path);
    const pdf = await getDocument(path).promise;
    try {
      const sentences: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const { items } = await page.getTextContent();
        const text = items.map((item) => ('str' in item ? item.str : '')).join('\n');
        this.appendSentences(text, sentences);
      }
      return sentences;
    } finally {
      await pdf.destroy();
    }
  }

  protected async onOff() {
    if (!this.initialized || this.destroyed) return;
    if (!this.lastReadSet && !this.isSpeaking) {
      this.lastReadSet = true;
      void this.db.updateBookLastRead(this.id, new Date());
    }
    if (this.spritzState.isSpritz) {
      if (!this.isSpeaking) await this.playback.stop();
      this.spritzSpeaking = !this.isSpeaking;
      if (this.isSpeaking) void this.spritz();
      return;
    }
    if (!this.speechReady || !this.texts.length) return;
    this.initializationError = '';
    clearTimeout(this.progressSaveTimer);
    try {
      await this.playback.toggle(
        {
          texts: this.texts,
          progress: this.progress(),
          ...this.speakParams,
          bookId: this.bookId,
          ...(this.speechState.voice ? { voiceURI: this.speechState.voice } : {}),
        },
        this.audioFocus,
      );
    } catch (error) {
      this.showSpeechError(error);
    }
  }

  private showSpeechError(error: unknown): void {
    this.initializationError = (error as Error)?.message || String(error);
    console.error('Text to speech failed', error);
  }

  private restoreNativeProgress(): Promise<void> {
    return this.playback.restoreProgress();
  }

  protected onChangeAudioFocus() {
    this.audioFocus = !this.audioFocus;
    if (this.playback.bookId === this.id) {
      void this.playback.setAudioFocus(this.audioFocus).catch((error) => this.showSpeechError(error));
    }
  }

  private async wait(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), milliseconds);
    });
  }

  protected onStartRewinding(n: 0 | 1) {
    if (this.spritzState.isSpritz) this.spritzSpeaking = false;
    else void this.stopSpeaking(false);
    if (this.isRewinding) {
      this.stopRewind = true;
    }
    this.isRewinding = true;
    this.rewindTimer = setTimeout(async () => {
      this.rewindTimer = null;

      while (this.progress() > 0 && this.progress() < this.texts.length - 1) {
        if (this.stopRewind) {
          this.stopRewind = false;
          this.isRewinding = false;
          break;
        }
        await this.wait(1);
        this.progress.set(n ? this.progress() + 1 : this.progress() - 1);
      }

      this.isRewinding = false;
    }, 200);
  }

  protected onStopRewinding(n: 0 | 1) {
    if (this.isRewinding) {
      if (this.rewindTimer) {
        clearTimeout(this.rewindTimer);
        this.stopRewind = true;
        if (n) {
          this.progress.set(this.progress() + 1 > this.texts.length - 1 ? this.texts.length - 1 : this.progress() + 1);
        } else {
          this.progress.set(this.progress() - 1 < 0 ? 0 : this.progress() - 1);
        }
        this.stopStartSpeaking();
      } else {
        this.stopRewind = true;
      }
    }
  }

  protected changeProgress(progress: number): void {
    if (this.spritzState.isSpritz) {
      this.progress.set(progress);
      return;
    }
    if (!this.texts.length || progress < 0) return;
    this.progress.set(Math.min(progress, this.texts.length - 1));
    this.scheduleProgressSave();
  }

  private scheduleProgressSave() {
    if (!this.texts?.length || (!this.spritzState.isSpritz && this.playback.bookId === this.id && this.isSpeaking))
      return;
    clearTimeout(this.progressSaveTimer);
    const progress2DB = (this.progress() || 0) + '/' + (this.texts.length - 1);
    this.progressSaveTimer = setTimeout(() => {
      if (!this.spritzState.isSpritz && this.playback.bookId === this.id && this.isSpeaking) return;
      this.db.updateBookProgress(this.id, progress2DB).then(() => {
        if (this.spritzState.isSpritz && this.progress() === this.texts.length - 1)
          this.db.updateBookFinished(this.id, new Date());
      });
    }, 200);
  }

  protected stopStartSpeaking() {
    this.scheduleProgressSave();
    if (!this.spritzState.isSpritz) {
      if (this.isSpeaking) void this.stopSpeaking(false);
    } else {
      if (this.isSpeaking) {
        this.spritzSpeaking = false;
      }
      this.spritzState.sentence = this.texts[this.progress()];
      this.spritz();
    }
  }

  private stopSpeaking(restoreProgress = true): Promise<void> {
    if (this.playback.bookId !== this.id) return Promise.resolve();
    return this.playback.stop(restoreProgress).catch((error) => this.showSpeechError(error));
  }

  private getRecognitionPositions(length: number): number[] {
    if (length === 1) return [1];
    if (length <= 4) return [2];
    if (length <= 9) return [3];
    if (length <= 13) return [4];
    if (length === 14) return [3, 10];
    if (length <= 16) return [3, 11];
    if (length <= 18) return [3, 12];
    if (length === 19) return [3, 13];
    return [3, 14];
  }

  private async spritz() {
    for (let sentenceIndex = this.progress(); sentenceIndex < this.texts.length - 1; sentenceIndex++) {
      if (!this.texts[sentenceIndex]) continue;
      const words = this.texts[sentenceIndex].split(/\s+/);
      this.spritzState.sentence = this.texts[sentenceIndex];
      for (let i = 0; i < words.length; i++) {
        const wordTrimmed = words[i].trim();
        if (!/[A-Za-z0-9]+/.test(wordTrimmed)) continue;
        for (const index of this.getRecognitionPositions(wordTrimmed.length)) {
          this.printWord(wordTrimmed, index, words.slice(i + 1).join(' '));
          if (!this.isSpeaking) break;
          const timeout = Math.floor(60000 / this.readingDetails.speed);
          await this.wait(timeout);

          if (!/[.,?!]/.test(wordTrimmed)) continue;
          this.printWord(' ', 1, '');
          await this.wait(Math.floor(timeout / 2));
        }
        if (!this.isSpeaking) break;
      }
      if (this.isSpeaking) this.progress.update((progress) => progress + 1);
      else break;
    }
  }

  private printWord(word: string, index: number, suffix: string) {
    this.spritzState.preText = word.slice(0, index - 1);
    this.spritzState.redText = word[index - 1];
    this.spritzState.postTextWhite = word.length >= index ? word.slice(index) : '';
    this.spritzState.postTextGray = ' ' + suffix;
  }

  protected increaseFontSize(): void {
    const currentSize = parseFloat(this.spritzState.fontSize);
    const fontSize = currentSize < 32 ? currentSize + 0.1 : currentSize;
    this.spritzState.fontSize = `${fontSize}px`;
    this.spritzState.contHeight = `${fontSize * 3 + 10}px`;
    void this.strg.set('fs', this.spritzState.fontSize);
  }

  protected decreaseFontSize(): void {
    const fontSize = parseFloat(this.spritzState.fontSize);
    this.spritzState.fontSize = `${fontSize > 10 ? fontSize - 0.1 : fontSize}px`;
  }

  protected changeSpeed(direction: '+' | '-'): void {
    if (!this.spritzState.isSpritz && this.isSpeaking) void this.stopSpeaking();
    const speed = this.readingDetails.speed;
    const isSpritz = this.spritzState.isSpritz;
    const step = isSpritz ? 10 : 1;
    const canChange = direction === '-' ? speed > (isSpritz ? 100 : 5) : speed < (isSpritz ? 1000 : 40);
    if (canChange) this.readingDetails.speed += direction === '-' ? -step : step;
    void this.strg.set(isSpritz ? 'spritzSpeed' : 'speed', isSpritz ? this.readingDetails.speed : speed);
  }

  protected onRateChange(value: number): void {
    this.speakParams.rate = value;
    if (this.isSpeaking) this.stopSpeaking();
  }

  protected onVolumeChange(value: number): void {
    this.speakParams.volume = value;
    if (this.isSpeaking) this.stopSpeaking();
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.speechReady = false;
    clearTimeout(this.rewindTimer);
    clearTimeout(this.progressSaveTimer);
    this.stopRewind = true;
    this.spritzSpeaking = false;
    this.strg.set('speed', this.speakParams.rate);
    this.working.done();
    this.scheduleProgressSave();
  }
}
