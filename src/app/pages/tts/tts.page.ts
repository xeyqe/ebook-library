import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { Platform } from '@ionic/angular';
import { TTS } from '@xeyqe/capacitor-tts';
import { Storage } from '@ionic/storage-angular';
import { AudioFocus } from 'capacitor-audio-focus';

import { Subscription } from 'rxjs';

import { BusyService } from 'src/app/services/busy.service';
import { EpubService } from 'src/app/services/epub.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';

import * as PDFJS from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'


@Component({
  selector: 'app-tts',
  templateUrl: './tts.page.html',
  styleUrls: ['./tts.page.scss'],
})
export class TtsComponent implements OnInit, OnDestroy {
  protected id: number;
  private path: string;
  protected texts: string[];
  protected progress: number;

  protected htmlData: {
    inBg: boolean,
    speed: number,
    title: string,
    authorName: string,
  };

  protected spritzObj: {
    isSpritz: boolean,
    preText: string,
    redText: string,
    postText: string,
    sentense: string,
    fontSize: string;
    contHeight: string;
  };

  protected speechObj: {
    language: string;
    languages: string[];
    voices: { [lang: string]: { voiceURI: string, name: string }[] };
    voice: string;
    engines: { name: string, label: string, icon: number }[];
    maxSpeechLength: number;
    isSpeaking: boolean,
  };

  protected initialized = false;

  private isRewinding: boolean;
  private stopRewind: boolean;

  private subs: Subscription[] = [];
  protected myForm: FormGroup<{
    engine: FormControl<string>,
    language: FormControl<string>,
    voice: FormControl<string>,
  }>;
  protected interval: ReturnType<typeof setTimeout>;

  private lastReadSet: boolean;
  private progressObj: { [progress: number]: number, toAdd: number };
  private spProgress: number;
  private audioFocusPluginListener: PluginListenerHandle;


  constructor(
    private db: DatabaseService,
    private directoryServ: DirectoryService,
    private epubService: EpubService,
    private fs: FileReaderService,
    private platform: Platform,
    private ref: ChangeDetectorRef,
    private route: ActivatedRoute,
    private strg: Storage,
    private working: BusyService,
  ) { }

  ngOnInit() {
    this.initialize();
    this.takeCareOfResume();
    this.initVariablesFromStorage();
    this.initVariablesFromDatabase();
    if (!this.spritzObj.isSpritz) this.initSpeechOptions();
  }

  private initialize() {
    this.spritzObj = {} as any;
    this.spritzObj.fontSize = '20px';
    this.spritzObj.contHeight = '70px';
    this.speechObj = {} as any;
    this.speechObj.engines = [];
    this.speechObj.languages = [];
    this.speechObj.voices = {};
    this.htmlData = {} as any;
    this.htmlData.speed = 30;
    this.htmlData.authorName = '';
  }

  private takeCareOfResume() {
    this.subs.push(this.platform.resume.subscribe(() => {
      this.htmlData.inBg = false;
      setTimeout(() => {
        this.ref.detach();
        this.ref.detectChanges();
        this.ref.reattach();
      }, 500);
    }));
    this.subs.push(this.platform.pause.subscribe(() => {
      this.htmlData.inBg = true;
    }));
  }

  private getRouteParams(): Promise<{ id: string, type: 'speech' | 'spritz' }> {
    return new Promise((resolve, reject) => {
      this.route.paramMap.subscribe({
        next: (params) => {
          resolve({
            id: params.get('id'),
            type: params.get('type') as any
          });
        },
        error: (error) => {
          reject(error);
        }
      });
    });

  }

  private async initVariablesFromStorage() {
    try {
      const params = await this.getRouteParams();
      this.id = +params.id;
      const lastListened = await this.db.getValue('as');
      this.db.saveValue('as', JSON.stringify({ id: this.id, type: params.type }));

      this.spritzObj.isSpritz = params.type === 'spritz';
      if (this.spritzObj.isSpritz) {
        this.htmlData.speed = await this.strg.get('spritzSpeed') || 300;
        const val = await this.strg.get('fs');
        if (val) {
          this.spritzObj.fontSize = val;
          this.spritzObj.contHeight = (+val.replace('px', '') * 3 + 10) + 'px';
        }
      } else {
        this.htmlData.speed = await this.strg.get('speed') || 30;
      }

      if (!lastListened || JSON.parse(lastListened).id !== this.id) {
        this.stopSpeaking();
      }
    } catch (e) {
      console.error(`initVariablesFromStorage failed`)
      console.error(e)
    }
  }

  private waitTillDbReady(): Promise<boolean> {
    return new Promise((resolve) => {
      this.db.getDatabaseState().subscribe({
        next: (ready) => {
          resolve(ready);
        },
        error: (e) => {
          console.error('waitTillDbReady');
          console.error(e);
          resolve(false)
        }
      });
    })
  }

  private async initVariablesFromDatabase() {
    if (!(await this.waitTillDbReady())) throw new Error('initVariablesFromDatabase failed')
    const book = await this.db.getBook(this.id);
    if (!book) return;
    this.path = book.path;
    this.htmlData.title = book.title;

    const progressArray = book.progress?.split('/') || ['0', '0'];
    this.progress = +progressArray[0];

    this.texts = await this.getTexts();
    if (this.progress && +progressArray[1] !== this.texts.length) {
      const percents = this.progress / +progressArray[1];
      this.progress = Math.floor(this.texts.length * percents);
    }
    this.spProgress = this.progress;
    this.setProgress2DB();

    this.progressObj = { 0: 0, toAdd: 0 };
    this.texts.forEach((str, index) => {
      this.progressObj[index + 1] = this.progressObj[index] + str.length;
    });
    this.progressObj.toAdd = this.progressObj[this.progress];

    this.working.done();

    const author = await this.db.getAuthor(book.creatorIds[0]);
    this.htmlData.authorName = (author.name || '') + ' ' + (author.surname || '');
    this.initialized = true;
  }

  private async initSpeechOptions() {
    let loadedValue = await this.db.getValue('tts');
    let engine: string;
    if (loadedValue) {
      loadedValue = JSON.parse(loadedValue);
    } else {
      loadedValue = {};
      const defaults = await TTS.getDefaults();
      console.log(defaults)
      engine = defaults.engine;
      loadedValue.engine = defaults.engine;
      loadedValue.language = defaults.language;
      loadedValue.voice = defaults.voiceURI;
    }
    this.speechObj.maxSpeechLength = (await TTS.getMaxSpeechInputLength()).maxSpeechInputLength;
    this.speechObj.voice = loadedValue.voice;
    this.speechObj.language = loadedValue.language;

    this.myForm = new FormGroup({
      engine: new FormControl(loadedValue?.engine),
      language: new FormControl(loadedValue?.language),
      voice: new FormControl(loadedValue?.voice),
    });

    if (loadedValue && loadedValue.engine !== engine)
      await TTS.switchEngine({ engineName: loadedValue.engine });

    console.log('before progressEvent')
    TTS.addListener('progressEvent', (a) => {
      if ((this.progressObj.toAdd + a.end) > this.progressObj[this.progress + 1]) {
        this.progress++;
        this.ref.detectChanges();
      }
    });

    this.subs.push(this.myForm.valueChanges.subscribe(() => {
      this.db.saveValue('tts', JSON.stringify(this.myForm.value));
      if (this.speechObj.isSpeaking) {
        this.stopSpeaking();
      }
    }));

    this.subs.push(this.myForm.get('voice').valueChanges.subscribe(voice => {
      this.speechObj.voice = voice;
    }));
    this.subs.push(this.myForm.get('engine').valueChanges.subscribe(async engine => {
      this.working.busy();
      TTS.switchEngine({ engineName: engine }).catch(e => console.error(e)).finally(async () => {
        await this.setLangsVoicesLists();
        this.myForm.get('language').setValue(this.speechObj.languages[0]);
        this.myForm.get('voice').setValue(this.speechObj.voices[this.speechObj.languages[0]] ? this.speechObj.voices[this.speechObj.languages[0]][0]?.voiceURI : null);
        this.working.done();
      });
    }));
    this.subs.push(this.myForm.get('language').valueChanges.subscribe(language => {
      this.speechObj.language = language;
      this.myForm.get('voice').setValue(this.speechObj.voices[language]?.length ? this.speechObj.voices[language][0]?.voiceURI : null);
    }));

    this.setLangsVoicesLists();

    TTS.getSupportedEngines().then(engines => {
      console.log('engines')
      console.log(engines)
      this.speechObj.engines = engines.engines;
    });
  }

  private async setLangsVoicesLists() {
    await TTS.getSupportedLanguages().then(langs => {
      console.log('langs')
      console.log(langs)
      this.speechObj.languages = langs.languages.sort();
    });
    await TTS.getSupportedVoices().then(voices => {
      console.log('voices')
      console.log(voices)
      this.speechObj.voices = {};
      voices.voices.forEach(voice => {
        if (!this.speechObj.voices[voice.lang])
          this.speechObj.voices[voice.lang] = [];
        this.speechObj.voices[voice.lang].push({ voiceURI: voice.voiceURI, name: voice.name });
      });
    });
  }

  private getTexts(): Promise<string[]> {
    this.working.busy();
    const extension = this.path.substring(this.path.lastIndexOf('.') + 1);
    if (extension === 'txt') {
      return this.getTextsFromString();
    } else if (extension === 'epub') {
      return this.getTextsFromEpub();
    } else if (extension === 'pdf') {
      return this.getTextsFromPdf();
    }
  }

  private getTextsFromString(): Promise<string[]> {
    return this.fs.readTextFile(this.path).then((str) => {
      const output = [];
      str.split(/(?=[.!?][“"\n\s])|(?<=[.!?][“"\n\s])/).forEach((it, i) => {
        if (i % 2 === 0) output.push(it);
        else output[output.length - 1] += it;
      });

      return output;
    }).catch(e => {
      console.error(e);
      return [];
    });
  }

  private async getTextsFromEpub(): Promise<string[]> {
    return this.epubService.getText(this.path);
  }

  private async getTextsFromPdf(): Promise<string[]> {
    PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    const path = Capacitor.convertFileSrc(this.directoryServ.imgPreLink + this.path);
    const pdf = await PDFJS.getDocument(path).promise;

    console.log((await pdf.getMetadata()));
    const output = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items;
      const str = textItems.map(item => item[`str`]).join('\n');
      str.split(/(?=[.!?][“"\n\s])|(?<=[.!?][“"\n\s])/).forEach((it, i) => {
        if (i % 2 === 0) output.push(it);
        else output[output.length - 1] += it;
      });
    }
    return output;
  }

  protected speak() {
    if (!this.texts) return;
    if (!this.working.isSpeaking) this.working.isSpeaking = true;
    this.speechObj.isSpeaking = true;
    this.saveAuthorTitle();
    let text2Speak = this.texts[this.progress];
    if (this.spProgress > this.progress) {
      console.log(this.spProgress, this.progress);
      this.progress = this.spProgress;
    }
    let add2Progress = 1;

    this.progressObj.toAdd = this.progressObj[this.progress];

    do {
      if (this.texts[this.progress + add2Progress]) {
        text2Speak = text2Speak + this.texts[this.progress + add2Progress];
      }
      add2Progress++;
    } while (
      this.texts[this.progress + add2Progress] &&
      text2Speak.length + this.texts[this.progress + add2Progress].length < this.speechObj.maxSpeechLength
    );
    const params = {
      text: text2Speak,
      rate: this.htmlData.speed / 10,
    };
    if (this.speechObj.voice) params[`voiceURI`] = this.speechObj.voice;
    this.spProgress = this.progress + add2Progress - 1;
    TTS.speak(params).then(() => {
      if (this.progress < this.texts.length) {
        this.progress++;
        this.setProgress2DB();
        this.speak();
      } else {
        this.working.isSpeaking = false;
        this.speechObj.isSpeaking = false;
        this.audioFocusPluginListener.remove();
        AudioFocus.abandonFocus();
      }
    }).catch((reason) => {
      this.working.isSpeaking = false;
      this.speechObj.isSpeaking = false;
      console.error('tts speak failed: ');
      console.error(reason);
    });

  }

  private saveAuthorTitle() {
    this.db.saveValue('author', this.htmlData.authorName);
    this.db.saveValue('title', this.htmlData.title);
    this.db.saveValue('this.speechObj.isSpeaking', this.speechObj.isSpeaking);
  }

  protected async onOff() {
    if (!this.lastReadSet && !this.speechObj.isSpeaking) {
      this.lastReadSet = true;
      this.db.updateBookLastRead(this.id, new Date());
    }
    if (this.spritzObj.isSpritz) {
      this.speechObj.isSpeaking = !this.speechObj.isSpeaking;
      this.saveAuthorTitle();
      this.spritz();
    } else {
      if (this.speechObj.isSpeaking) {
        AudioFocus.abandonFocus();
        this.audioFocusPluginListener.remove();
        this.stopSpeaking();
      } else {
        this.audioFocusPluginListener = await AudioFocus.addListener('audioFocusChangeEvent', (resp) => {
          if (resp.type === 'AUDIOFOCUS_LOSS') this.stopSpeaking();
        });
        AudioFocus.requestFocus().then(() => {
          this.speak();
        });
      }
    }
  }

  private async wait(milliseconds: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => resolve(), milliseconds);
    });
  }

  protected onStartRewinding(n: 0 | 1) {
    this.speechObj.isSpeaking = true;
    this.onOff();
    if (this.isRewinding) {
      this.stopRewind = true;
    }
    this.isRewinding = true;
    this.interval = setTimeout(async () => {
      this.interval = null;

      while (this.progress > 0 && this.progress < this.texts.length) {
        if (this.stopRewind) {
          this.stopRewind = false;
          this.isRewinding = false;
          break;
        }
        await this.wait(1);
        this.progress = n ? this.progress + 1 : this.progress - 1;
        this.spProgress = this.progress;
      }

      this.isRewinding = false;
    }, 200);
  }

  protected onStopRewinding(n: 0 | 1) {
    if (this.isRewinding) {
      if (this.interval) {
        clearInterval(this.interval);
        this.stopRewind = true;
        if (n) {
          this.progress = (this.progress + 1 > this.texts.length) ? this.texts.length : this.progress + 1;
        } else {
          this.progress = this.progress - 1 < 0 ? 0 : this.progress - 1;
        }
        this.spProgress = this.progress;
        this.stopStartSpeaking();
      } else {
        this.stopRewind = true;
      }
    }
  }

  protected changeProgress(progress: number) {
    if (this.spritzObj.isSpritz) {
      this.progress = progress;
    } else {
      if (this.texts) {
        if (progress >= 0) {
          if (progress > this.texts.length) {
            progress = this.texts.length;
          }
          this.progress = progress;
          this.setProgress2DB();
        }
      }
    }
    this.spProgress = this.progress;
  }

  private setProgress2DB() {
    if (!this.texts?.length) return;
    const progress2DB = (this.progress || 0) + '/' + this.texts.length;

    this.db.updateBookProgress(this.id, progress2DB).then(() => {
      if (this.progress === this.texts.length)
        this.db.updateBookFinished(this.id, new Date());
    });
  }

  protected stopStartSpeaking() {
    this.setProgress2DB();
    if (!this.spritzObj.isSpritz) {
      if (this.speechObj.isSpeaking) {
        this.stopSpeaking();
      }
    } else {
      if (this.speechObj.isSpeaking) {
        this.speechObj.isSpeaking = false;
        this.saveAuthorTitle();
      }
      this.spritzObj.sentense = this.texts[this.progress];
      this.spritz();
    }
  }

  private async stopSpeaking(): Promise<any> {
    this.speechObj.isSpeaking = false;
    this.working.isSpeaking = false;
    this.saveAuthorTitle();
    try {
      await TTS.stop();
    } catch (e) {
      console.error(e);
    }
  }

  private redIndexFinder(length: number): number[] {
    if (length === 1) {
      return [1];
    } else if (length >= 2 && length <= 4) {
      return [2];
    } else if (length >= 5 && length <= 9) {
      return [3];
    } else if (length >= 10 && length <= 13) {
      return [4];
    } else if (length === 14) {
      return [3, 10];
    } else if (length === 15 || length === 16) {
      return [3, 11];
    } else if (length === 17 || length === 18) {
      return [3, 12];
    } else if (length === 19) {
      return [3, 13];
    } else {
      return [3, 14];
    }
  }

  private async spritz() {
    for (let i = this.progress; i < this.texts.length; i++) {
      if (!this.texts[i]) continue;
      const words = this.texts[i].split(/[\s]+/);
      this.spritzObj.sentense = this.texts[i];
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordTrimmed = word.trim();
        if (!/[A-Za-z0-9]+/.test(wordTrimmed)) continue;
        for (const index of this.redIndexFinder(wordTrimmed.length)) {
          this.printWord(wordTrimmed, index, words.slice(i + 1).join(' '));
          if (!this.speechObj.isSpeaking) break;
          const timeout = Math.floor(60000 / this.htmlData.speed);
          await this.wait(timeout);

          if (!/[.,?!]/.test(wordTrimmed)) continue;
          this.printWord(' ', 1, '');
          await this.wait(Math.floor(timeout/2));
        }
        if (!this.speechObj.isSpeaking) break;
      }
      if (this.speechObj.isSpeaking) this.progress++;
      else break;
    }
  }

  private printWord(word: string, index: number, suffix: string) {
    this.spritzObj.preText = word.slice(0, index - 1);
    this.spritzObj.redText = word[index - 1];
    const postText = word.length >= index ? word.slice(index) : '';
    this.spritzObj.postText = postText + ' ' + suffix;
  }

  protected increaseFontSize() {
    let str = this.spritzObj.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num < 32) {
      num += 0.1;
    }
    this.spritzObj.fontSize = num + 'px';
    this.spritzObj.contHeight = (num * 3 + 10) + 'px';
    this.strg.set('fs', this.spritzObj.fontSize);
  }

  protected decreaseFontSize() {
    let str = this.spritzObj.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num > 10) {
      num -= 0.1;
    }
    this.spritzObj.fontSize = num + 'px';
  }

  protected changeSpeed(str: string) {
    if (!this.spritzObj.isSpritz && this.speechObj.isSpeaking) this.stopSpeaking();
    const speed = this.htmlData.speed;
    if (str === '-') {
      if (this.spritzObj.isSpritz) {
        if (speed > 100) {
          this.htmlData.speed = speed - 10;
        }
      } else {
        if (speed > 5) {
          this.htmlData.speed = speed - 1;
        }
      }
    } else {
      if (this.spritzObj.isSpritz) {
        if (speed < 1000) {
          this.htmlData.speed = speed + 10;
        }
      } else {
        if (speed < 40) {
          this.htmlData.speed = speed + 1;
        }
      }
    }

    if (this.spritzObj.isSpritz) {
      this.strg.set('spritzSpeed', this.htmlData.speed);
    } else {
      this.strg.set('speed', speed);
    }
  }

  // private getTextFromChapter(chapter: CHAPTER): Promise<string[]> {
  //   return this.epubService.getTextsFromEpub(chapter.src);
  // }

  ngOnDestroy() {
    this.working.done();
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.setProgress2DB();
  }
}
