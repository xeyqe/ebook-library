import { Injectable } from '@angular/core';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { DatabaseService } from './database.service';
import { Subject } from 'rxjs';
import { FileReaderService } from './file-reader.service';
import { Storage } from '@ionic/storage';


@Injectable({
  providedIn: 'root'
})
export class TtsService {

  texts: string[];
  initialized = false;
  language = 'en-US';
  speed = 30;
  progress = 0;
  isSpeaking = false;
  speakingLengthLimit = 500;

  private speedSubject = new Subject<number>();
  private progressSubject = new Subject<number>();

  count = 0;

  bookId: number;

  constructor(
    private tts: TextToSpeech,
    private db: DatabaseService,
    private fs: FileReaderService,
    private strg: Storage
    ) { }

  startSpeaking(bookId: number) {
    this.bookId = bookId;
    return new Promise((resolve, reject) => {
      this.strg.get('speed').then(val => {
        if (val) {
          this.speed = val;
        } else {
          this.speed = 30;
        }
      }).catch(e => {
        console.log('storage failed: ');
        console.log(e);
      });
      this.db.getBook(bookId).then(book => {
        const path = book.path;
        if (book.language) {
          this.language = book.language;
        }

        this.fs.readTextFile(path).then(str => {
          this.texts = this.getTexts(str);

          let progr = book.progress;
          if (progr) {
            progr = progr.substring(0, progr.indexOf('/'));
            this.changeProgress(parseInt(progr, 10));
          } else {
            this.db.updateBookProgress(bookId, '0/' + this.texts.length);
            this.changeProgress(0);
          }
          this.initialized = true;
          resolve();
        });
      }).catch(e => {
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
      } while (text2Speak.length + this.texts[this.progress + add2Progress].length < this.speakingLengthLimit);

      this.tts.speak({
        text: text2Speak,
        locale: this.language,
        rate: this.speed / 10}).then(_ => {
          if (this.progress < this.texts.length) {
            this.changeProgress(this.progress + add2Progress);
            this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
            this.count++;
            this.speak();
          } else {
            this.isSpeaking = false;
          }
        }).catch(reason => {
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
    if (progress >= 0) {
      if (progress > this.texts.length) {
        progress = this.texts.length;
      }
      this.progress = progress;
      this.progressSubject.next(progress);
      this.db.updateBookProgress(this.bookId, progress + '/' + this.texts.length);
    }
  }

  getProgress() {
    return this.progressSubject.asObservable();
  }

  getSpeed() {
    return this.speedSubject.asObservable();
  }

  getTextsLenght() {
    return this.texts.length;
  }

  getTexts(str: string) {
    const arrayOfParagraphs = str.split(/\n+/g);
    const regex = RegExp('[A-Za-z0-9]+');
    const newArray = [];

    arrayOfParagraphs.forEach(element => {
      if (element && regex.test(element)) {
        let length = element.length;
        if (length < 790) {
          newArray.push(element);
        } else {
          const arrayOfSentences = element.split(/\.\ /g);
          arrayOfSentences.forEach(sentence => {
            length = sentence.length;
            if (sentence && length < 790 && regex.test(sentence)) {
              newArray.push(sentence + '. ');
            } else {
              const thousands = Math.floor(length / 790);
              for (let j = 0; j < thousands; j++) {
                const partOfSentence = sentence.substring(j * 790, (j + 1) * 790);
                if (partOfSentence && regex.test(partOfSentence)) {
                  newArray.push(partOfSentence);
                }
              }
            }
          });
        }
      }
    });
    return newArray;
  }

  changeSpeakingLimit(limit: number) {
    if (limit > 4000 || limit < 500) {
      return;
    }
    this.speakingLengthLimit = limit;
  }
  
}
