import { Injectable } from '@angular/core';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';
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



  bookId: number;

  constructor(
    private tts: TextToSpeech,
    private notif: LocalNotifications,
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

          this.launchNotification(bookId);
          this.notif.on('pause').subscribe(_ => {
            if (this.isSpeaking) {
              this.stopSpeaking();
            } else {
              this.speak();
            }
          });
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
          text2Speak = text2Speak + this.texts[i] + '.';
        }
      }

      this.tts.speak({
        text: text2Speak,
        locale: this.language,
        rate: this.speed / 10}).then(_ => {
          if (this.progress < this.texts.length) {
            this.changeProgress(this.progress + 5);
            this.notif.update({id: 1, progressBar: {value: this.percents()}});
            this.db.updateBookProgress(this.bookId, this.progress + '/' + this.texts.length);
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

  launchNotification(bookId: number) {
    this.db.getBook(bookId).then(book => {
      const bookTitle = book.title;
      this.db.getAuthor(book.creatorId).then(author => {
        const authorName = author.name + ' ' + author.surname;
        this.notif.schedule({
          id: 1,
          title: authorName,
          text: bookTitle,
          sticky: true,
          sound: null,
          wakeup: false,
          color: 'black',
          progressBar: { value: this.percents()},
          actions: [
              { id: 'pause', title: '||' }
          ]
        });
      });
    });
  }

  stopSpeaking() {
    this.notif.update({
      id: 1,
      sticky: false
    });
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
      this.notif.update({id: 1, progressBar: {value: this.percents()}});
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

    // for (let i = 0; i < array.length; i ++) {
    //   const element = array[i];
    array.forEach(element => {
      if (regex.test(element)) {
        const length = element.length;
        if (length < 4000) {
          newArray.push(element);
        } else {
          const thousands = Math.floor(length / 1000);
          for (let j = 0; j < thousands; j++) {
            const token = element.substring(j * 1000, (j + 1) * 1000);
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
