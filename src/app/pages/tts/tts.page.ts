import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';

import { Platform } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { TextToSpeech } from 'capacitor-text-to-speech';

import { Subscription } from 'rxjs';

import { BusyService } from 'src/app/services/busy.service';
import { EpubService } from 'src/app/services/epub.service';
import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';


@Component({
  selector: 'app-tts',
  templateUrl: './tts.page.html',
  styleUrls: ['./tts.page.scss'],
})
export class TtsComponent implements OnInit, OnDestroy {
  protected id: number;
  protected path: string;
  protected title: string;
  protected isSpeaking = false;
  protected speed = 30;

  protected fontSize = '20px';
  protected contHeight = '70px';
  protected authorName = '';
  protected textsLength = 0;

  protected texts: string[];
  protected progress: number;
  protected spritzBoolean = false;
  protected spritzPreText: string;
  protected spritzRedText: string;
  protected spritzPostText: string;
  protected sentense = '';
  protected speakingLengthLimit = 500;

  protected extension = 'txt';

  protected language: string;
  protected languages: string[];
  protected voices: { [lang: string]: { voiceURI: string, name: string }[] };
  protected voice: string;
  protected engines: { name: string, label: string, icon: number }[];

  protected initialized = false;
  protected isWorking = false;

  private isRewinding: boolean;
  private stopRewind: boolean;

  private subs: Subscription[] = [];
  protected myForm: FormGroup<{
    engine: FormControl<string>,
    language: FormControl<string>,
    voice: FormControl<string>,
  }>;
  protected interval: ReturnType<typeof setTimeout>;
  protected inBg: boolean;

  private lastReadSet: boolean;


  constructor(
    private db: DatabaseService,
    private epubService: EpubService,
    private fs: FileReaderService,
    private platform: Platform,
    private ref: ChangeDetectorRef,
    private route: ActivatedRoute,
    private strg: Storage,
    private working: BusyService,
  ) { }

  ngOnInit() {
    try {
      console.log('ngOnInit')
      this.initVariablesFromStorage();
      this.initVariablesFromDatabase();
      if (!this.spritzBoolean) {
        this.initSpeechOptions();
      }
      this.subs.push(this.platform.resume.subscribe(() => {
        this.inBg = false;
        const title = this.title;
        this.title = 'title';
        setTimeout(() => {
          this.title = title;
          // this.ref.markForCheck();
          this.ref.detach();
          this.ref.detectChanges();
          this.ref.reattach();
        }, 500);
        console.log(this.inBg);
        // this.ref.markForCheck();
      }));
      this.subs.push(this.platform.pause.subscribe(() => {
        this.inBg = true;
        console.log(this.inBg);
      }));
      console.log('ngOnInit end')
    } catch (e) {
      console.error(`ngOnInit`)
      console.error(e)
    }
  }

  private initVariablesFromStorage() {
    try {
    let oldBookId: string;
    this.route.paramMap.subscribe((params) => {
      let bookId = params.get('id');
      this.db.getValue('as').then((num) => {
        oldBookId = num;
      }).catch(e => {
        console.error(`this.db.getValue('as') failed`)
        console.error(e);
      });
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;
        this.strg.get('speed').then((val) => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 30;
          }
        }).catch((e) => {
          console.error('storage failed: ');
          console.error(e);
          this.speed = 300;
        });
      } else {
        this.spritzBoolean = true;
        this.strg.get('spritzSpeed').then((val) => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 300;
          }
        }).catch((e) => {
          console.error('storage failed: ');
          console.error(e);
          this.speed = 300;
        });

        this.strg.get('fs').then((val) => {
          if (val) {
            this.fontSize = val;
            this.contHeight = (+val.replace('px', '') * 3 + 10) + 'px';
          }
        }).catch(e => {
          console.error(`this.strg.get('fs') failed`)
          console.error(e)
        });
      }

      if (!oldBookId || oldBookId !== bookId) {
        this.stopSpeaking();
      }
      bookId = bookId.substring(0, bookId.length - 1);
      this.id = parseInt(bookId, 10);
    });
  } catch (e) {
    console.error(`initVariablesFromStorage failed`)
    console.error(e)
  }
  }

  private initVariablesFromDatabase() {
    try {
    this.subs.push(this.db.getDatabaseState().subscribe((ready) => {
      console.log(`ready: ${ready}`)
      if (ready) {
        this.db.getBook(this.id).then((book) => {
          this.path = book.path;
          this.title = book.title;

          // if (book.language) {
          //   this.language = book.language;
          // }

          this.extension = book.path.substring(book.path.lastIndexOf('.') + 1);

          if (book.progress) {
            const progressArray = book.progress.split('/');
            this.progress = parseInt(progressArray[0], 10);
          }

          this.getTexts().then(texts => {
            this.texts = texts;
            this.textsLength = texts.length;
            if (!this.progress) {
              this.progress = 0;
            }
            this.isWorking = false;
          });

          this.db.getAuthor(book.creatorId).then((author) => {
            this.authorName = (author.name || '') + ' ' + (author.surname || '');
          });
          this.initialized = true;
        }).catch((e) => {
          console.error('getBook failed: ');
          console.error(e);
        });
      }
    }));
  } catch (e) {
    console.error(`initVariablesFromDatabase`)
    console.error(e)
  }
  }

  private async initSpeechOptions() {
    let loadedValue = await this.db.getValue('tts');
    let engine: string;
    if (loadedValue) {
      loadedValue = JSON.parse(loadedValue);
    } else {
      loadedValue = {};
      const defaults = await TextToSpeech.getDefaults();
      console.log(defaults)
      engine = defaults.engine;
      loadedValue.engine = defaults.engine;
      loadedValue.language = defaults.language;
      loadedValue.voice = defaults.voice;
    }
    this.voice = loadedValue.voice;
    this.language = loadedValue.language;

    this.myForm = new FormGroup({
      engine: new FormControl(loadedValue?.engine),
      language: new FormControl(loadedValue?.language),
      voice: new FormControl(loadedValue?.voice),
    });

    if (loadedValue && loadedValue.engine !== engine)
      await TextToSpeech.switchEngine({ engineName: loadedValue.engine });

    this.subs.push(this.myForm.valueChanges.subscribe(() => {
      this.db.saveValue('tts', JSON.stringify(this.myForm.value));
      if (this.isSpeaking) {
        this.stopSpeaking();
      }
    }));

    this.subs.push(this.myForm.get('voice').valueChanges.subscribe(voice => {
      this.voice = voice;
    }));
    this.subs.push(this.myForm.get('engine').valueChanges.subscribe(async engine => {
      this.working.busy();
      TextToSpeech.switchEngine({ engineName: engine }).catch(e => console.error(e)).finally(async () => {
        await this.setLangsVoicesLists();
        this.myForm.get('language').setValue(this.languages[0]);
        this.myForm.get('voice').setValue(this.voices[this.languages[0]] ? this.voices[this.languages[0]][0]?.voiceURI : null);
        this.working.done();
      });
    }));
    this.subs.push(this.myForm.get('language').valueChanges.subscribe(language => {
      this.language = language;
      this.myForm.get('voice').setValue(this.voices[language]?.length ? this.voices[language][0]?.voiceURI : null);
    }));

    this.setLangsVoicesLists();

    TextToSpeech.getSupportedEngines().then(engines => {
      console.log('engines')
      console.log(engines)
      this.engines = engines.engines;
    });
  }

  private async setLangsVoicesLists() {
    await TextToSpeech.getSupportedLanguages().then(langs => {
      console.log('langs')
      console.log(langs)
      this.languages = langs.languages.sort();
    });
    await TextToSpeech.getSupportedVoices().then(voices => {
      console.log('voices')
      console.log(voices)
      this.voices = {};
      voices.voices.forEach(voice => {
        if (!this.voices[voice.lang])
          this.voices[voice.lang] = [];
        this.voices[voice.lang].push({ voiceURI: voice.voiceURI, name: voice.name });
      });
    });
  }

  private getTexts(): Promise<string[]> {
    this.isWorking = true;
    const extension = this.path.substring(this.path.lastIndexOf('.') + 1);
    if (extension === 'txt') {
      return this.getTextsFromString();
    } else if (extension === 'epub') {
      return this.getTextsFromEpub();
    }
  }

  private getTextsFromString(): Promise<string[]> {
    return this.fs.readTextFile(this.path).then((str) => {
      const arrayOfParagraphs = str.split(/\n+/g);
      const regex = RegExp('[A-Za-z0-9]+');
      const newArray = [];

      arrayOfParagraphs.forEach((element) => {
        if (element && regex.test(element)) {
          let length = element.length;

          const arrayOfSentences = element.split(/\.\ /g);

          for (let i = 0; i < arrayOfSentences.length; i++) {
            let sentence = arrayOfSentences[i];
            length = arrayOfSentences[i].length;
            if (sentence && length < 790 && regex.test(sentence)) {
              i === arrayOfSentences.length - 1 ? (sentence = sentence) : (sentence += '.');
              newArray.push(sentence);
            } else {
              const thousands = Math.floor(length / 790);
              for (let j = 0; j < thousands; j++) {
                const partOfSentence = sentence.substring(j * 790, (j + 1) * 790);
                if (partOfSentence && regex.test(partOfSentence)) {
                  newArray.push(partOfSentence);
                }
              }
            }
          }
        }
      });

      return newArray;
    }).catch(e => {
      console.error(e);
      return [];
    });
  }

  private async getTextsFromEpub(): Promise<string[]> {
    // const outputTexts: string[] = [];
    // return this.epubService.unzipEpub(this.path).then(async num => {
    //   if (num === 0) {

    //     await this.epubService.getChapters().then(async (chapters) => {
    //       for (const chapter of chapters) {
    //         await new Promise((next) => {
    //           this.getTextFromChapter(chapter).then((texts) => {
    //             if (texts && (texts as string[]).length) {
    //               for (const text of texts as string[]) {
    //                 if (text) {
    //                   outputTexts.push(text);
    //                 }
    //               }
    //             }
    //             next();
    //           });
    //         });
    //       }
    //     });
    //     return outputTexts;
    //   }
    // });
    return this.epubService.getText(this.path);
  }

  protected speak() {
    if (this.texts) {
      if (!this.working.isSpeaking) this.working.isSpeaking = true;
      this.isSpeaking = true;
      this.saveAuthorTitle();
      let text2Speak = '';
      let add2Progress = 0;

      do {
        if (this.texts[this.progress + add2Progress]) {
          text2Speak = text2Speak + this.texts[this.progress + add2Progress];
        }
        add2Progress++;
      } while (
        this.texts[this.progress + add2Progress] &&
        text2Speak.length + this.texts[this.progress + add2Progress].length < this.speakingLengthLimit
      );
      const params = {
        text: text2Speak,
        lang: this.language,
        rate: this.speed / 10,
      };
      if (this.voice) params[`voice`] = this.voice;
      console.log('params')
      console.log(params)
      TextToSpeech.speak(params).then(() => {
        if (this.progress < this.texts.length) {
          this.changeProgress(this.progress + add2Progress);
          // this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
          this.speak();
        } else {
          this.working.isSpeaking = false;
          this.isSpeaking = false;
          this.saveAuthorTitle();
        }
      }).catch((reason) => {
        this.working.isSpeaking = false;
        this.isSpeaking = false;
        this.saveAuthorTitle();
        console.error('tts speak failed: ');
        console.error(reason);
      });
    }
  }

  private saveAuthorTitle() {
    this.db.saveValue('author', this.authorName);
    this.db.saveValue('title', this.title);
    this.db.saveValue('isSpeaking', this.isSpeaking);
  }

  protected onOff() {
    if (!this.lastReadSet && !this.isSpeaking) {
      this.lastReadSet = true;
      this.db.updateBookLastRead(this.id, new Date());
    }
    if (this.spritzBoolean) {
      this.isSpeaking = !this.isSpeaking;
      this.saveAuthorTitle();
      this.spritz();
    } else {
      if (this.isSpeaking) {
        this.stopSpeaking();
      } else {
        this.speak();
      }
    }
  }

  private async wait(milliseconds: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, milliseconds);
    });
  }

  protected onStartRewinding(n: 0 | 1) {
    this.isSpeaking = true;
    this.onOff();
    if (this.isRewinding) {
      this.stopRewind = true;
    }
    this.isRewinding = true;
    this.interval = setTimeout(async () => {
      this.interval = null;

      while (this.progress > 0 && this.progress < this.textsLength) {
        if (this.stopRewind) {
          this.stopRewind = false;
          this.isRewinding = false;
          break;
        }
        await this.wait(1);
        this.progress = n ? this.progress + 1 : this.progress - 1;
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
          this.progress = this.progress + 1 > this.textsLength ? this.textsLength : this.progress + 1;
        } else {
          this.progress = this.progress - 1 < 0 ? 0 : this.progress - 1;
        }
        this.stopStartSpeaking();
      } else {
        this.stopRewind = true;
      }
    }
  }

  protected changeProgress(progress: number) {
    if (this.spritzBoolean) {
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
  }

  private setProgress2DB() {
    if (this.texts) {
      let progress2DB: string;
      if (this.progress === this.texts.length) {
        progress2DB = 'finished';
      } else if (this.progress) {
        progress2DB = this.progress + '/' + this.texts.length;
      } else {
        progress2DB = null;
      }
      this.db.updateBookProgress(this.id, progress2DB).then(() => {
        if (progress2DB === 'finished') this.db.updateBookFinished(this.id, new Date());
      });
    }
  }

  protected stopStartSpeaking() {
    this.setProgress2DB();
    if (!this.spritzBoolean) {
      if (this.isSpeaking) {
        this.stopSpeaking();
      }
    } else {
      if (this.isSpeaking) {
        this.isSpeaking = false;
        this.saveAuthorTitle();
      }
      this.sentense = this.texts[this.progress];
      this.spritz();
    }
  }

  private stopSpeaking(): Promise<any> {
    this.isSpeaking = false;
    this.working.isSpeaking = false;
    this.saveAuthorTitle();
    return TextToSpeech.stop();
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
    const slowRegex = new RegExp('[.,?!]');
    let addedMs = 0;
    const timeout = Math.floor(60000 / this.speed);
    for (let i = this.progress; i < this.texts.length; i++) {
      if (!this.texts[i]) continue;
      const words = this.texts[i].split(/[\s]+/);
      this.sentense = this.texts[i];
      for (const word of words) {
        const slovo = word.trim();
        const regex = new RegExp('[A-Za-z0-9]+');
        if (regex.test(slovo)) {
          for (const index of this.redIndexFinder(slovo.length)) {
            this.printWord(slovo, index);
            if (!this.isSpeaking) {
              break;
            }
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                resolve();
              }, timeout);
            });
            addedMs = 0;
            if (slowRegex.test(slovo)) {
              this.printWord(' ', 1);
              addedMs = Math.floor(timeout / 2);
              await new Promise<void>((resolve) => {
                setTimeout(() => {
                  resolve();
                }, addedMs);
              });
            }
          }
          if (!this.isSpeaking) {
            break;
          }
        }
      }
      if (this.isSpeaking) {
        this.progress++;
      } else {
        break;
      }
    }
  }

  private printWord(word: string, index: number) {
    this.spritzPreText = word.substring(0, index - 1);
    this.spritzRedText = word[index - 1];
    this.spritzPostText = word.substring(index);
  }

  private async waitFn() {
    const ms = 60000 / this.speed;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  protected increaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num < 32) {
      num += 0.1;
    }
    this.fontSize = num + 'px';
    this.contHeight = (num * 3 + 10) + 'px';
    this.strg.set('fs', this.fontSize);
  }

  protected decreaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num > 10) {
      num -= 0.1;
    }
    this.fontSize = num + 'px';
  }

  protected changeSpeed(str: string) {
    if (!this.spritzBoolean && this.isSpeaking) this.stopSpeaking();
    const speed = this.speed;
    if (str === '-') {
      if (this.spritzBoolean) {
        if (speed > 100) {
          this.speed = speed - 10;
        }
      } else {
        if (speed > 5) {
          this.speed = speed - 1;
        }
      }
    } else {
      if (this.spritzBoolean) {
        if (speed < 1000) {
          this.speed = speed + 10;
        }
      } else {
        if (speed < 40) {
          this.speed = speed + 1;
        }
      }
    }

    if (this.spritzBoolean) {
      this.strg.set('spritzSpeed', this.speed);
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
