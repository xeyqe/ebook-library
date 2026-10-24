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
  factory: () => ({
    read: (options) => (TTS as unknown as ReaderPlugin).read(options),
    speak: (options) => TTS.speak(options),
    stop: () => TTS.stop(),
    getSupportedLanguages: () => TTS.getSupportedLanguages(),
    getSupportedVoices: () => TTS.getSupportedVoices(),
    getSupportedEngines: () => TTS.getSupportedEngines(),
    switchEngine: (options) => TTS.switchEngine(options),
    getMaxSpeechInputLength: () => TTS.getMaxSpeechInputLength(),
    getDefaults: () => TTS.getDefaults(),
    openInstall: () => TTS.openInstall(),
    addListener: (event, callback) => TTS.addListener(event, callback),
    requestFocus: () => TTS.requestFocus(),
    abandonFocus: () => TTS.abandonFocus(),
  }),
});
