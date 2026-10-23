import { InjectionToken } from '@angular/core';
import { TTS, TTSPlugin, TTSReadOptions } from '@xeyqe/capacitor-tts';

// The local plugin's Android implementation takes a voice name, although its
// generated declaration currently types voiceURI as a number.
export type ReadOptions = Omit<TTSReadOptions, 'voiceURI'> & { voiceURI?: string };
export type ReaderPlugin = Omit<TTSPlugin, 'read'> & {
  read(options: ReadOptions): Promise<void>;
};

export const TTS_PLUGIN = new InjectionToken<ReaderPlugin>('TTS plugin', {
  providedIn: 'root',
  factory: () => TTS as unknown as ReaderPlugin,
});
