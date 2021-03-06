import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Storage } from '@ionic/storage';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';

import { Subscription } from 'rxjs';

import { EpubService } from 'src/app/services/epub.service';
import { CHAPTER } from 'src/app/services/interfaces.service';
import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';

// interface IOptions {
//   /** text to speak */
//   text: string;
//   /** a string like 'en-US', 'zh-CN', etc */
//   locale?: string;
//   /** speed rate, 0 ~ 1 */
//   rate?: number;
//   /** ambient(iOS) */
//   category?: string;
// }


// declare var cordova: any;
@Component({
  selector: 'app-tts',
  templateUrl: './tts.page.html',
  styleUrls: ['./tts.page.scss'],
})
export class TtsPage implements OnInit, OnDestroy {
  id: number;
  path: string;
  title: string;
  isSpeaking = false;
  speed = 30;

  fontSize = '20px';
  authorName = '';
  textsLength = 0;

  texts: string[];
  progress: number;
  spritzBoolean = false;
  // averageWordLength: number;
  spritzPreText: string;
  spritzRedText: string;
  spritzPostText: string;
  sentense = '';
  speakingLengthLimit = 500;

  extension = 'txt';

  language = 'en-US';

  initialized = false;
  isWorking = false;

  subs1: Subscription;
  subs2: Subscription;
  subs3: Subscription;


  constructor(
    private route: ActivatedRoute,
    private fs: FileReaderService,
    private db: DatabaseService,
    private strg: Storage,
    private epubService: EpubService,
    private tts: TextToSpeech
  ) { }

  ngOnInit() {
    this.initVariablesFromStorage();
    this.initVariablesFromDatabase();
  }

  private initVariablesFromStorage() {
    let oldBookId: string;
    this.route.paramMap.subscribe((params) => {
      let bookId = params.get('id');
      this.db.getValue('as').then((num) => {
        oldBookId = num;
      });
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;
        this.strg
        .get('speed')
        .then((val) => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 30;
          }
        })
        .catch((e) => {
          console.log('storage failed: ');
          console.log(e);
          this.speed = 300;
        });
      } else {
        this.spritzBoolean = true;
        this.strg
          .get('spritzSpeed')
          .then((val) => {
            if (val) {
              this.speed = val;
            } else {
              this.speed = 300;
            }
          })
          .catch((e) => {
            console.log('storage failed: ');
            console.log(e);
            this.speed = 300;
          });

        this.strg.get('fs').then((val) => {
          if (val) {
            this.fontSize = val;
          }
        });
      }

      if (!oldBookId || oldBookId !== bookId) {
        this.stopSpeaking();
      }
      bookId = bookId.substring(0, bookId.length - 1);
      this.id = parseInt(bookId, 10);
    });
  }

  private initVariablesFromDatabase() {
    this.subs1 = this.db.getDatabaseState().subscribe((ready) => {
      if (ready) {
        this.db
          .getBook(this.id)
          .then((book) => {
            this.path = book.path;
            this.title = book.title;

            if (book.language) {
              this.language = book.language;
            }

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
              this.authorName = author.name + ' ' + author.surname;
            });
            this.initialized = true;
          })
          .catch((e) => {
            console.log('getBook failed: ');
            console.log(e);
          });
      }
    });
  }

  private getTexts(): Promise<string[]> {
    this.isWorking = true;
    if (this.path.substring(this.path.lastIndexOf('.') + 1) === 'txt') {
      return this.getTextsFromString();
    } else if (this.path.substring(this.path.lastIndexOf('.') + 1) === 'epub') {
      return this.getTextsFromEpub();
    }
  }

  private getTextsFromString(): Promise<string[]> {
    return this.fs
      .readTextFile(this.path)
      .then((str) => {
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

  speak() {
    if (this.texts) {
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

      this.tts.speak({
        text: text2Speak,
        locale: this.language,
        rate: this.speed / 10,
      }).then((_) => {
        if (this.progress < this.texts.length) {
          this.changeProgress(this.progress + add2Progress);
          // this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
          this.speak();
        } else {
          this.isSpeaking = false;
          this.saveAuthorTitle();
        }
      }).catch((reason) => {
        this.isSpeaking = false;
        this.saveAuthorTitle();
        console.log('tts speak failed: ');
        console.log(reason);
      });
    }
  }


  private saveAuthorTitle() {
    this.db.saveValue('author', this.authorName);
    this.db.saveValue('title', this.title);
    this.db.saveValue('isSpeaking', this.isSpeaking);
  }

  onOff() {
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

  backward() {
    if (!this.progress) {
      this.progress = 0;
    }
    if (this.spritzBoolean && this.progress > 0) {
      this.progress -= 1;
    } else {
      this.changeProgress(this.progress - 1);
    }
    this.stopStartSpeaking();
  }

  forward() {
    if (!this.progress) {
      this.progress = 0;
    }
    if (this.spritzBoolean && this.progress < this.texts.length - 1) {
      this.progress += 1;
    } else {
      this.changeProgress(this.progress + 1);
    }
    this.stopStartSpeaking();
  }

  changeProgress(progress: number) {
    if (this.spritzBoolean) {
      this.progress = progress;
    } else {
      if (this.texts) {
        if (progress >= 0) {
          if (progress > this.texts.length) {
            progress = this.texts.length;
          }
          this.progress = progress;

          let progress2DB: string;
          if (this.progress === this.texts.length) {
            progress2DB = 'finished';
          } else if (progress) {
            progress2DB = progress + '/' + this.texts.length;
          } else {
            progress2DB = null;
          }
          this.db.updateBookProgress(this.id, progress2DB);
        }
      }
    }
  }


  stopStartSpeaking() {
    if (!this.spritzBoolean) {
      if (this.isSpeaking) {
        this.stopSpeaking().then(() => {
          this.speak();
        });
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
    this.saveAuthorTitle();
    return this.tts.speak('');
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

  increaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num < 32) {
      num += 0.1;
    }
    this.fontSize = num + 'px';
    this.strg.set('fs', this.fontSize);
  }

  decreaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num > 10) {
      num -= 0.1;
    }
    this.fontSize = num + 'px';
  }

  changeSpeed(str: string) {
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
    if (this.subs1) {
      this.subs1.unsubscribe();
    }
    if (this.subs2) {
      this.subs2.unsubscribe();
    }
    if (this.subs3) {
      this.subs3.unsubscribe();
    }
    if (this.texts) {
      let progress: string;
      if (this.progress === this.texts.length) {
        progress = 'finished';
      } else if (this.progress) {
        progress = this.progress + '/' + this.texts.length;
      } else {
        progress = null;
      }
      this.db.updateBookProgress(this.id, progress);
    }
  }
}
