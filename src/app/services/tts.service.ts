import { Injectable } from '@angular/core';

import { Subject } from 'rxjs';

import { Storage } from '@ionic/storage';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';

import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { EpubService } from './epub.service';

@Injectable({
  providedIn: 'root',
})
export class TtsService {
  texts: string[] = [];
  initialized = false;
  language = 'en-US';
  speed = 30;
  progress = 0;
  isSpeaking = false;
  speakingLengthLimit = 500;
  extension = 'txt';
  chapters;
  path: string;

  authorName: string;
  bookTitle: string;

  private speedSubject = new Subject<number>();
  private progressSubject = new Subject<number>();

  count = 0;

  bookId: number;

  constructor(
    private tts: TextToSpeech,
    private db: DatabaseService,
    private fs: FileReaderService,
    private strg: Storage,
    private epubService: EpubService
  ) {}

  startSpeaking(bookId: number) {
    this.bookId = bookId;
    return new Promise((resolve, reject) => {
      this.strg
        .get('speed')
        .then((val) => {
          if (val) {
            this.speed = val;
            this.speedSubject.next(val);
          } else {
            this.speed = 30;
            this.speedSubject.next(30);
          }
        })
        .catch((e) => {
          console.log('storage failed: ');
          console.log(e);
        });
      this.db
        .getBook(bookId)
        .then((book) => {
          const path = book.path;
          if (book.language) {
            this.language = book.language;
          }
          this.path = book.path;

          this.extension = book.path.substring(book.path.lastIndexOf('.') + 1);

          if (this.extension === 'epub') {
            this.epubService.unzipEpub(book.path).then((num) => {
              if (num === 0) {
                this.getTextsFromEpub().then(() => {
                  let progr = book.progress;
                  if (progr) {
                    progr = progr.substring(0, progr.indexOf('/'));
                    this.changeProgress(parseInt(progr, 10));
                  } else {
                    this.changeProgress(0);
                  }
                  this.initialized = true;
                  resolve();
                });
              } else {
                reject();
              }
            });
          } else {
            this.fs.readTextFile(path).then((str) => {
              this.texts = this.getTexts(str);

              let progr = book.progress;
              if (progr) {
                progr = progr.substring(0, progr.indexOf('/'));
                this.changeProgress(parseInt(progr, 10));
              } else {
                this.changeProgress(0);
              }
              this.initialized = true;
              resolve();
            });
          }
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  speak() {
    if (this.texts) {
      this.isSpeaking = true;
      let text2Speak = '';
      let add2Progress = 0;

      do {
        if (this.texts[this.progress + add2Progress]) {
          text2Speak = text2Speak + this.texts[this.progress + add2Progress];
        }
        add2Progress++;
      } while (
        this.texts[this.progress + add2Progress] &&
        text2Speak.length + this.texts[this.progress + add2Progress].length <
          this.speakingLengthLimit
      );

      this.tts
        .speak({
          text: text2Speak,
          locale: this.language,
          rate: this.speed / 10,
        })
        .then((_) => {
          if (this.progress < this.texts.length) {
            this.changeProgress(this.progress + add2Progress);
            // this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
            this.speak();
          } else {
            this.isSpeaking = false;
          }
        })
        .catch((reason) => {
          this.isSpeaking = false;
          console.log('tts speak failed: ');
          console.log(reason);
        });
    } else {
      this.startSpeaking(this.bookId);
    }
  }

  stopSpeaking() {
    this.count = 0;
    this.isSpeaking = false;
    return this.tts.speak('');
  }

  percents() {
    return (this.progress / this.texts.length) * 100;
  }

  changeSpeed(speed: number) {
    this.speedSubject.next(speed);
    this.speed = speed;
    this.strg.set('speed', speed);
  }

  changeProgress(progress: number) {
    if (this.texts) {
      if (progress >= 0) {
        if (progress > this.texts.length) {
          progress = this.texts.length;
        }
        this.progress = progress;
        this.progressSubject.next(progress);

        let progress2DB: string;
        if (this.progress === this.texts.length) {
          progress2DB = 'finished';
        } else if (progress) {
          progress2DB = progress + '/' + this.texts.length;
        } else {
          progress2DB = null;
        }
        this.db.updateBookProgress(this.bookId, progress2DB);
      }
    }
  }

  getProgress() {
    return this.progressSubject.asObservable();
  }

  getSpeed() {
    return this.speedSubject.asObservable();
  }

  getSp() {
    return this.speed;
  }

  getTextsLenght() {
    return this.texts ? this.texts.length : 0;
  }

  getTexts(str: string) {
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
  }

  async getTextsFromEpub() {
    this.epubService.getChapters().then(async (chapters) => {
      for (const chapter of chapters) {
        await new Promise((next) => {
          this.getTextFromChapter(chapter).then((texts) => {
            if (texts && (texts as string[]).length) {
              for (const text of texts as string[]) {
                if (text) {
                  this.texts.push(text);
                }
              }
            }
            next();
          });
        });
      }
    });
  }

  private getTextFromChapter(chapter) {
    return new Promise((resolve) => {
      this.epubService.getTextFromEpub(this.path, chapter.src).then((str) => {
        resolve(str);
      });
    });
  }

  changeSpeakingLimit(limit: number) {
    if (limit > 4000 || limit < 500) {
      return;
    }
    this.speakingLengthLimit = limit;
  }

  ifSpeaking() {
    return this.isSpeaking;
  }

  setAuthorName(name: string) {
    this.authorName = name;
  }

  getAuthorName(): string {
    return this.authorName;
  }

  setBookTitle(title: string) {
    this.bookTitle = title;
  }

  getEpubTexts() {
    return this.texts;
  }

  getBookTitle(): string {
    return this.bookTitle;
  }
}
