import { Component, OnInit, OnDestroy } from '@angular/core';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { ActivatedRoute } from '@angular/router';
import { FileReaderService } from './../../services/file-reader.service';
import { DatabaseService } from './../../services/database.service';
import { Storage } from '@ionic/storage';
import { LocalNotifications } from '@ionic-native/local-notifications/ngx';

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
  dot = '';
  speed = 3.00;
  fontSize = '20px';
  authorName = '';
  language = 'cs-CZ';


  texts: string[];
  progress: number;
  spritzBoolean = false;
  averageWordLength: number;
  spritzPreText: string;
  spritzRedText: string;
  spritzPostText: string;
  sentense = '';



  constructor(private tts: TextToSpeech,
              private route: ActivatedRoute,
              private fs: FileReaderService,
              private db: DatabaseService,
              private strg: Storage,
              private notif: LocalNotifications) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      let bookId = params.get('id');
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;

        this.notif.on('pause').subscribe(_ => {
          console.log('pause');
          this.onOff();
        });

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
      } else {
        this.spritzBoolean = true;
        this.strg.get('spritzSpeed').then(val => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 300;
          }
          console.log(val);
        }).catch(e => {
          console.log('storage failed: ');
          console.log(e);
          this.speed = 300;
        });

        this.strg.get('fs').then(val => {
          if (val) {
            this.fontSize = val;
          }
        });
      }
      bookId = bookId.substring(0, bookId.length - 1);
      this.id = parseInt(bookId, 10);

      if (this.spritzBoolean) {
        this.tts.speak('');
      }
    });

    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        this.db.getBook(this.id).then(book => {
          this.path = book.path;
          this.title = book.title;
          if (book.progress) {
            this.progress = parseInt(book.progress.split('/')[0], 10);
          }
          this.getText();

          this.db.getAuthor(book.creatorId).then(author => {
            this.authorName = author.name;
          });
        }).catch(e => {
          console.log('getBook failed: ');
          console.log(e);
        });
      }
    });
  }


  getText() {
    this.fs.readTextFile(this.path).then(str => {
      this.texts = str.split(/\.\s/g);
      this.dot = '.';
      const countOfWords = str.match(/\S+/g).length;
      const countOfWhiteSpaces = str.match(/\s/g).length;

      const lengthOfText = str.length;
      const lengthWithoutWhiteSpaces = lengthOfText - countOfWhiteSpaces;

      this.averageWordLength = lengthWithoutWhiteSpaces / countOfWords;

      if (!this.progress) {
        this.db.updateBookProgress(this.id, '0/' + this.texts.length);
        this.progress = 0;
      }

    }).catch(e => {
      console.log('readTextFile failed: ');
      console.log(e);
    });
  }

  onOff() {
    if (this.spritzBoolean) {
      if (!this.isSpeaking) {
        this.isSpeaking = !this.isSpeaking;
        this.spritz();
      } else {
        this.isSpeaking = !this.isSpeaking;
      }
    } else {
      if (this.isSpeaking) {
        this.notif.update({
          id: 1,
          sticky: false
        });
        this.tts.speak('');
        this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
      } else {
        this.launchNotification();
        this.speak();
      }
      this.isSpeaking = !this.isSpeaking;
    }
  }

  launchNotification() {
    this.notif.schedule({
      id: 1,
      title: this.authorName,
      text: this.title,
      sticky: true,
      sound: null,
      wakeup: false,
      color: 'black',
      progressBar: { value: this.percents()},
      actions: [
          { id: 'pause', title: '||' }
      ]
    });

  }

  percents() {
    return (this.progress / this.texts.length) * 100;
  }

  speak() {
    if (this.texts) {
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
            this.progress += 5;
            this.notif.update({id: 1, progressBar: {value: this.percents()}});
            this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
            this.speak();
          }
        }).catch(reason => {
          console.log('tts speak failed: ');
          console.log(reason);
        });
    }
  }

  backward() {
    if (this.progress - 1 > 0) {
      this.progress -= 1;
      this.stopStartSpeaking();
    }
  }

  forward() {
    if (this.progress < this.texts.length) {
      this.progress += 1;
      this.stopStartSpeaking();
    }
  }

  changeProgress(event) {
    this.progress = event.detail.value;
    this.notif.update({id: 1, progressBar: {value: this.percents()}});
  }

  stopStartSpeaking() {
    if (!this.spritzBoolean) {
      if (this.isSpeaking) {
        this.tts.speak('').then(() => {
          this.speak();
        }).catch(e => {
          console.log('stopStartSpeaking failed: ');
          console.log(e);
        });
      }
    }
  }

  async spritz() {
    let slova: string[];

    for (let i = this.progress; i < this.texts.length; i++) {
      if (!this.isSpeaking) {
        break;
      }
      this.sentense = this.texts[i] + '.';
      const msForOneWord = Math.floor(60000 / this.speed);
      const msForOneCharacter = Math.floor(msForOneWord / this.averageWordLength);

      const paragraph = this.texts[i];
      slova = paragraph.split(/[\s]+/);
      console.log(slova);
      for (const word of slova) {
        if (!this.isSpeaking) {
          break;
        }
        if (word.length) {
          const timeoutMs = word.length * msForOneCharacter < msForOneWord ? msForOneWord : Math.floor(word.length * msForOneCharacter);
          this.printWord(word);
          await  new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, Math.floor(timeoutMs));
          });
        }
      }
      if (this.isSpeaking) {
        this.progress++;
      }
    }
  }

  printWord(word: string) {
    word = word.trim();

    if (word.length === 1) {
      this.spritzPreText = '';
      this.spritzRedText = word[0];
      this.spritzPostText = '';
    } else if (word.length < 6) {
      this.spritzPreText = word[0];
      this.spritzRedText = word[1];
      this.spritzPostText = word.substring(2);
    } else if (word.length < 10) {
      this.spritzPreText = word.substring(0, 2);
      this.spritzRedText = word[2];
      this.spritzPostText = word.substring(3);
    } else {
      this.spritzPreText = word.substring(0, 3);
      this.spritzRedText = word[3];
      this.spritzPostText = word.substring(4);
    }
  }

  increaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num < 32) {
      num += 0.1;
    }
    this.fontSize =  num + 'px';
    this.strg.set('fs', this.fontSize);
  }

  decreaseFontSize() {
    let str = this.fontSize;
    str = str.substring(0, str.length - 2);
    let num = parseFloat(str);
    if (num > 10) {
      num -= 0.1;
    }
    this.fontSize =  num + 'px';
  }

  changeSpeed(str: string) {
    if (this.speed > 0) {
      if (str === '-') {
        this.spritzBoolean ? this.speed -= 10 : this.speed -= 1;
      } else {
        this.spritzBoolean ? this.speed += 10 : this.speed += 1;
      }

      this.spritzBoolean ? this.strg.set('spritzSpeed', this.speed) : this.strg.set('speed', this.speed);
    }
  }

  changeLanguage() {
    if (this.language === 'cs-CZ') {
      this.language = 'en-US';
    } else {
      this.language = 'cs-CZ';
    }
  }

  ngOnDestroy() {
    if (this.texts) {
      this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
    }
  }

}
