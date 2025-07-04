import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, signal } from '@angular/core';
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


import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import { ForegroundService, Importance } from '@capawesome-team/capacitor-android-foreground-service';



@Component({
  selector: 'app-tts',
  templateUrl: './tts.page.html',
  styleUrls: ['./tts.page.scss'],
  standalone: false,
})
export class TtsComponent implements OnInit, OnDestroy {
  @HostListener('window:orientationchange')
  onOrientationChange() {
    this.isPortrait = window.screen.orientation.type.startsWith('portrait');
    console.log(this.isPortrait)
  }
  protected isPortrait: boolean;
  protected id: number;
  private path: string;
  protected texts: string[];
  protected progress = signal(0);

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
    postTextWhite: string,
    postTextGray: string,
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
  private audioFocusPluginListener: PluginListenerHandle;
  protected speakParams: {
    rate: number;
    pitch: number;
    volume: number;
    pan: number;
  } = {
      rate: 3,
      pitch: 1,
      volume: 1,
      pan: 0
    };
  protected audioFocus = true;
  private last: number;

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
    this.isPortrait = window.screen.orientation.type.startsWith('portrait');
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
        this.speakParams.rate = await this.strg.get('speed') || 3;
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
    this.progress.set(+progressArray[0]);

    this.texts = await this.getTexts();
    if (this.progress() && +progressArray[1] !== this.texts.length - 1) {
      const percents = this.progress() / +progressArray[1];
      this.progress.set(Math.floor(this.texts.length - 1 * percents));
    }
    this.setProgress2DB();
    this.working.done();

    const author = await this.db.getAuthor(book.creatorIds[0]);
    this.htmlData.authorName = [author.name, author.surname].filter(it => !!it).join(' ') || author.pseudonym;
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
      str.split(/(?=[.!?][“"\n\s])|(?<=[.!?][“"\n\s])/).forEach(it => {
        if (output[output.length - 1] && it.length < 5) {
          output[output.length - 1] += it;
        } else {
          output.push(it);
        }
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
    // PDFJS.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    const path = Capacitor.convertFileSrc(this.directoryServ.imgPreLink + this.path);
    const pdf = await getDocument(path).promise;

    console.log((await pdf.getMetadata()));
    const output = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items;
      const str = textItems.map(item => item[`str`]).join('\n');
      str.split(/(?=[.!?][“"\n\s])|(?<=[.!?][“"\n\s])/).forEach(it => {
        if (output[output.length - 1] && it.length < 5) {
          output[output.length - 1] += it;
        } else {
          output.push(it);
        }
      });
    }
    return output;
  }

  // protected speak(index: number) {
  //   console.log(index)
  //   if (!this.texts?.[index])
  //     throw new Error('leak');
  //   if (!this.working.isSpeaking) this.working.isSpeaking = true;
  //   this.speechObj.isSpeaking = true;
  //   const params = {
  //     text: this.texts[index],
  //     ...this.speakParams
  //   };
  //   if (this.speechObj.voice) params[`voiceURI`] = this.speechObj.voice;
  //   TTS.speak(params).then(() => {
  //     this.progress.update(old => old++);
  //     if (this.last + 1 < this.texts.length) {
  //       this.setProgress2DB();
  //       this.last++;
  //       this.speak(this.last);
  //     } else if (this.progress() === this.texts.length - 1) {
  //       this.working.isSpeaking = false;
  //       this.speechObj.isSpeaking = false;
  //       this.removeAudioFocus();
  //     }
  //   }).catch((reason) => {
  //     this.working.isSpeaking = false;
  //     this.speechObj.isSpeaking = false;
  //     console.error('tts speak failed: ');
  //     console.error(reason);
  //   });
  // }

  private saveAuthorTitle() {
    this.db.saveValue('author', this.htmlData.authorName);
    this.db.saveValue('title', this.htmlData.title);
    // this.db.saveValue('this.speechObj.isSpeaking', this.speechObj.isSpeaking);
  }

  protected async onOff() {
    if (!this.lastReadSet && !this.speechObj.isSpeaking) {
      this.lastReadSet = true;
      this.db.updateBookLastRead(this.id, new Date());
    }
    if (this.spritzObj.isSpritz) {
      this.speechObj.isSpeaking = !this.speechObj.isSpeaking;
      this.spritz();
    } else {
      if (this.speechObj.isSpeaking) {
        this.stopForegroundService();
        this.removeAudioFocus();
        this.stopSpeaking();
      } else {
        this.startForegroundService();
        this.setAudioFocus().then(() => {
          this.saveAuthorTitle();
          const params = {
            texts: this.texts,
            progress: this.progress(),
            ...this.speakParams
          };
          console.log(params)
          if (!this.working.isSpeaking) this.working.isSpeaking = true;
          this.speechObj.isSpeaking = true;
          TTS.read(params);
          TTS.addListener("progressArrayEvent", (resp) => {
            console.log(resp)
            this.progress.set(resp.progress);
            this.setProgress2DB();
          });
          // this.speak(this.progress());
          // if (this.progress() < this.texts.length - 1) {
          //   this.last = this.progress() + 1;
          //   this.speak(this.progress() + 1);
          // } else {
          //   this.last = this.progress();
          // }
        });
      }
    }
  }

  private startForegroundService = async () => {
    await this.createNotificationChannel();
    await ForegroundService.startForegroundService({
      id: 1,
      title: this.htmlData.authorName,
      body: this.htmlData.title,
      smallIcon: 'ic_launcher',
      serviceType: 2 as any,
      // serviceType: 1073741824 as any,
      silent: true,
      notificationChannelId: 'default',
    });
  };

  private stopForegroundService = async () => {
    await this.deleteNotificationChannel();
    await ForegroundService.stopForegroundService();
  };

  private createNotificationChannel = async () => {
    await ForegroundService.createNotificationChannel({
      id: 'default',
      name: 'Default',
      description: 'Default channel',
      importance: Importance.Default,
    });
  };

  private deleteNotificationChannel = async () => {
    await ForegroundService.deleteNotificationChannel({
      id: 'default',
    });
  };

  private async setAudioFocus(): Promise<void> {
    if (!this.audioFocus) return;
    this.audioFocusPluginListener = await AudioFocus.addListener('audioFocusChangeEvent', (resp) => {
      if (resp.type === 'AUDIOFOCUS_LOSS') this.stopSpeaking();
    });
    await AudioFocus.requestFocus();
  }

  private removeAudioFocus(): void {
    if (!this.audioFocus || !this.audioFocusPluginListener) return;
    AudioFocus.abandonFocus();
    this.audioFocusPluginListener.remove();
  }

  protected onChangeAudioFocus() {
    this.audioFocus = !this.audioFocus;
    if (this.audioFocus) this.setAudioFocus()
    else this.removeAudioFocus();
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
      if (this.interval) {
        clearInterval(this.interval);
        this.stopRewind = true;
        if (n) {
          this.progress.set((this.progress() + 1 > this.texts.length - 1) ? this.texts.length - 1 : this.progress() + 1);
        } else {
          this.progress.set(this.progress() - 1 < 0 ? 0 : this.progress() - 1);
        }
        this.stopStartSpeaking();
      } else {
        this.stopRewind = true;
      }
    }
  }

  protected changeProgress(progress: number) {
    if (this.spritzObj.isSpritz) {
      this.progress.set(progress);
    } else {
      if (this.texts) {
        if (progress >= 0) {
          if (progress > this.texts.length - 1) {
            progress = this.texts.length - 1;
          }
          this.progress.set(progress);
          this.setProgress2DB();
        }
      }
    }
  }

  private setProgress2DB() {
    if (!this.texts?.length) return;
    const progress2DB = (this.progress() || 0) + '/' + (this.texts.length - 1);

    this.db.updateBookProgress(this.id, progress2DB).then(() => {
      if (this.progress() === this.texts.length - 1)
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
      }
      this.spritzObj.sentense = this.texts[this.progress()];
      this.spritz();
    }
  }

  private async stopSpeaking(): Promise<any> {
    this.speechObj.isSpeaking = false;
    this.working.isSpeaking = false;
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
    for (let i = this.progress(); i < this.texts.length - 1; i++) {
      if (!this.texts[i]) continue;
      const words = this.texts[i].split(/[\s]+/);
      this.spritzObj.sentense = this.texts[i];
      for (let i = 0; i < words.length; i++) {
        const wordTrimmed = words[i].trim();
        if (!/[A-Za-z0-9]+/.test(wordTrimmed)) continue;
        for (const index of this.redIndexFinder(wordTrimmed.length)) {
          this.printWord(wordTrimmed, index, words.slice(i + 1).join(' '));
          if (!this.speechObj.isSpeaking) break;
          const timeout = Math.floor(60000 / this.htmlData.speed);
          await this.wait(timeout);

          if (!/[.,?!]/.test(wordTrimmed)) continue;
          this.printWord(' ', 1, '');
          await this.wait(Math.floor(timeout / 2));
        }
        if (!this.speechObj.isSpeaking) break;
      }
      if (this.speechObj.isSpeaking) this.progress.update(old => old++);
      else break;
    }
  }

  private printWord(word: string, index: number, suffix: string) {
    this.spritzObj.preText = word.slice(0, index - 1);
    this.spritzObj.redText = word[index - 1];
    // const postText = word.length >= index ? word.slice(index, index + 1) : '';
    // const splits = postText.split(' ');
    // this.spritzObj.postText = postText + ' ' + suffix;
    this.spritzObj.postTextWhite = word.length >= index ? word.slice(index) : '';
    this.spritzObj.postTextGray = ' ' + suffix; // splits.slice(1).join(' ');
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

  protected pinFormatter(value: number) {
    return value;
  }

  protected onRateChange(value: number): void {
    this.speakParams.rate = value;
    if (this.speechObj.isSpeaking) this.stopSpeaking();
  }

  protected onPitchChange(value: number): void {
    this.speakParams.pitch = value;
    if (this.speechObj.isSpeaking) this.stopSpeaking();
  }

  protected onVolumeChange(value: number): void {
    this.speakParams.volume = value;
    if (this.speechObj.isSpeaking) this.stopSpeaking();
  }

  protected onPanChange(value: number): void {
    this.speakParams.pan = value;
    if (this.speechObj.isSpeaking) this.stopSpeaking();
  }


  ngOnDestroy() {
    this.strg.set('speed', this.speakParams.rate);
    this.working.done();
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.setProgress2DB();
  }
}
