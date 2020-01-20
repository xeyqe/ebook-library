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
      for (let i = this.progress; i < this.progress + 5; i++) {
        if (this.texts[i]) {
          text2Speak = text2Speak + this.texts[i] + '. ';
        }
      }
      console.log(text2Speak);

      this.tts.speak({
        text: text2Speak,
        locale: this.language,
        rate: this.speed / 10}).then(_ => {
          if (this.progress < this.texts.length) {
            this.changeProgress(this.progress + 5);
            this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
            this.count++;
            console.log(this.count);
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
    const array = str.split(/(\.\ )|\n]+/g);
    const regex = RegExp('[A-Za-z0-9]+');
    const newArray = [];

    array.forEach(element => {
      if (regex.test(element)) {
        const length = element.length;
        if (length < 790) {
          newArray.push(element);
        } else {
          const thousands = Math.floor(length / 790);
          for (let j = 0; j < thousands; j++) {
            const token = element.substring(j * 790, (j + 1) * 790);
            if (regex.test(token)) {
              newArray.push(token);
            }
          }
        }
      }
    });
    return newArray;
  }


}
