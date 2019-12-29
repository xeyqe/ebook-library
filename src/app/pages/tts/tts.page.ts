import { Component, OnInit, OnDestroy } from '@angular/core';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { ActivatedRoute } from '@angular/router';
import { FileReaderService } from './../../services/file-reader.service';
import { DatabaseService } from './../../services/database.service';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { Storage } from '@ionic/storage';


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
              private bg: BackgroundMode,
              private strg: Storage) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      let bookId = params.get('id');
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;
        this.strg.get('speed').then(val => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 3.00;
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
        }).catch(e => {
          console.log('getBook failed: ');
          console.log(e);
        });
      }
    });
    // this.bg.enable();
  }


  getText() {
    this.fs.readTextFile(this.path, this.title).then(str => {
      // text.replace('\\r\\n', '\n');
      // if (str.includes('\r\n')) {
      //   this.texts = str.split('\r\n');
      //   this.dot = '';
      // } else {
      this.texts = str.split(/\.\s/g);
      this.dot = '.';
      // }
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
        this.tts.speak('');
        this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
      } else {
        this.speak();
      }
      this.isSpeaking = !this.isSpeaking;
    }
  }

  speak() {
    if (this.texts !== null) {
      this.tts.speak({
        text: this.texts[this.progress], // + this.dot,
        locale: 'cs-CZ',
        rate: this.speed}).then(_ => {
          if (this.progress < this.texts.length) {
            this.progress++;
            if (this.progress % 5 === 0) {
              this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
            }
            this.speak();
          }
        }).catch(reason => {
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
  }

  stopStartSpeaking() {
    if (!this.spritzBoolean) {
      if (this.isSpeaking) {
        this.bg.moveToForeground();
        this.tts.speak('').then(() => {
          this.speak();
        }).catch(e => {
          console.log('stopStartSpeaking failed: ');
          console.log(e);
        });
      } else {
        this.bg.moveToBackground();
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
    if (str === '-') {
      this.spritzBoolean ? this.speed -= 10 : this.speed -= 0.1;
    } else {
      this.spritzBoolean ? this.speed += 10 : this.speed += 0.1;
    }
    this.speed = Math.floor(this.speed * 10) / 10;
    this.spritzBoolean ? this.strg.set('spritzSpeed', this.speed) : this.strg.set('speed', this.speed);
  }

  move2Background() {
    this.bg.moveToBackground();
    setTimeout(() => {
      this.bg.moveToForeground();
    }, 2000);
  }


  ngOnDestroy() {
    this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
  }

}
