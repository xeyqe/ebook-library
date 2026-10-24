import { Injectable, inject, signal } from '@angular/core';
import { PluginListenerHandle } from '@capacitor/core';
import { BusyService } from './busy.service';
import { DatabaseService } from './database.service';
import { ReadOptions, TTS_PLUGIN } from './tts-plugin';

@Injectable({ providedIn: 'root' })
export class SpeechPlaybackService {
  readonly progress = signal(0);
  readonly isSpeaking = signal(false);
  readonly error = signal('');
  readonly bookId = signal<number>(undefined);
  private completed = false;
  private texts: string[] = [];
  private session = 0;
  private hasAudioFocus = false;
  private progressListener?: PluginListenerHandle;
  private focusListener?: PluginListenerHandle;
  private operation: Promise<void> = Promise.resolve();
  private readonly tts = inject(TTS_PLUGIN);
  private readonly db = inject(DatabaseService);
  private readonly working = inject(BusyService);

  private queue(operation: () => Promise<void>): Promise<void> {
    const pending = this.operation.then(operation);
    this.operation = pending.catch(() => {});
    return pending;
  }

  toggle(options: ReadOptions, audioFocus: boolean): Promise<void> {
    return this.queue(async () => {
      if (this.isSpeaking() && this.bookId() === options.bookId) {
        await this.stopSession();
        return;
      }
      await this.stopSession();
      this.bookId.set(options.bookId);
      this.texts = options.texts;
      this.progress.set(options.progress);
      this.completed = false;
      this.error.set('');
      const session = ++this.session;
      this.isSpeaking.set(true);
      this.working.isSpeaking.set(true);
      try {
        this.progressListener = await this.tts.addListener('progressArrayEvent', (event) => {
          if (session !== this.session || !Number.isInteger(event.progress)) return;
          this.progress.set(Math.max(0, Math.min(event.progress + 1, this.texts.length - 1)));
        });
        this.focusListener = await this.tts.addListener('audioFocusChangeEvent', (event) => {
          if (event.type?.startsWith('AUDIOFOCUS_LOSS')) {
            void this.stop().catch((error) => this.reportError(error));
          }
        });
        if (audioFocus) await this.requestAudioFocus();
        // The native foreground service owns reading, independently of routed pages.
        void this.tts
          .read(options)
          .then(
            () => this.finish(session),
            (error) => this.finish(session, error),
          )
          .catch((error) => this.reportError(error));
      } catch (error) {
        await this.stopSession();
        throw error;
      }
    });
  }

  stop(restoreProgress = true): Promise<void> {
    return this.queue(() => this.stopSession(true, restoreProgress));
  }

  pauseForBook(bookId: number): Promise<void> {
    return this.queue(async () => {
      if (this.isSpeaking() && this.bookId() !== bookId) await this.stopSession();
    });
  }

  switchEngine(engineName: string): Promise<void> {
    return this.queue(async () => {
      await this.stopSession();
      await this.tts.switchEngine({ engineName });
    });
  }

  private finish(session: number, error?: unknown): Promise<void> {
    return this.queue(async () => {
      if (session !== this.session) return;
      this.completed = !error;
      if (!error) this.progress.set(this.texts.length - 1);
      await this.stopSession(false);
      if (error && !String((error as Error)?.message || error).startsWith('Canceled:')) this.reportError(error);
    });
  }

  private reportError(error: unknown): void {
    this.error.set((error as Error)?.message || String(error));
    console.error('Text to speech failed', error);
  }

  private async stopSession(stopNative = true, restoreProgress = true): Promise<void> {
    const wasSpeaking = this.isSpeaking();
    ++this.session;
    this.isSpeaking.set(false);
    this.working.isSpeaking.set(false);
    try {
      if (stopNative && wasSpeaking) await this.tts.stop();
      if (restoreProgress && wasSpeaking && !this.completed) await this.restoreProgress();
    } finally {
      const progressListener = this.progressListener;
      const focusListener = this.focusListener;
      this.progressListener = undefined;
      this.focusListener = undefined;
      try {
        await progressListener?.remove();
      } finally {
        try {
          await focusListener?.remove();
        } finally {
          if (this.hasAudioFocus) {
            this.hasAudioFocus = false;
            await this.tts.abandonFocus();
          }
        }
      }
      if (wasSpeaking) await this.saveProgress();
    }
  }

  async restoreProgress(): Promise<void> {
    if (this.bookId() === undefined || !this.texts.length) return;
    const bookId = this.bookId();
    const session = this.session;
    const book = await this.db.getBook(bookId);
    const saved = Number(book?.progress?.split('/')[0]);
    if (session === this.session && bookId === this.bookId() && Number.isInteger(saved) && saved >= 0) {
      this.progress.set(Math.max(this.progress(), Math.min(saved, this.texts.length - 1)));
    }
  }

  private async saveProgress(): Promise<void> {
    await this.db.updateBookProgress(this.bookId(), `${this.progress()}/${this.texts.length - 1}`);
    if (this.completed) await this.db.updateBookFinished(this.bookId(), new Date());
  }

  setAudioFocus(enabled: boolean): Promise<void> {
    return this.queue(async () => {
      if (enabled && this.isSpeaking() && !this.hasAudioFocus) await this.requestAudioFocus();
      else if (!enabled && this.hasAudioFocus) {
        this.hasAudioFocus = false;
        await this.tts.abandonFocus();
      }
    });
  }

  private async requestAudioFocus(): Promise<void> {
    this.hasAudioFocus = true;
    let timeout: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        this.tts.requestFocus(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Audio focus was not granted. Please try again.')), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }
}
