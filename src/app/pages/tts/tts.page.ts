import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FileReaderService } from './../../services/file-reader.service';
import { DatabaseService } from './../../services/database.service';
import { Storage } from '@ionic/storage';
import { TtsService } from './../../services/tts.service';

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
  averageWordLength: number;
  spritzPreText: string;
  spritzRedText: string;
  spritzPostText: string;
  sentense = '';

  initialized = false;



  constructor(
              private route: ActivatedRoute,
              private fs: FileReaderService,
              private db: DatabaseService,
              private strg: Storage,
              private sp: TtsService) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      let bookId = params.get('id');
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;
      } else {
        this.spritzBoolean = true;
        this.strg.get('spritzSpeed').then(val => {
          if (val) {
            this.speed = val;
          } else {
            this.speed = 300;
          }
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

      this.sp.stopSpeaking();
    });

    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        this.db.getBook(this.id).then(book => {
          this.path = book.path;
          this.title = book.title;

          if (book.progress) {
            const progressArray = book.progress.split('/');
            this.progress = parseInt(progressArray[0], 10);
          }
          if (this.spritzBoolean) {
            this.getText();
          } else {
              this.sp.startSpeaking(book.id).then(_ => {
                this.sp.getProgress().subscribe(progress => {
                  this.progress = progress;
                });
                this.sp.getSpeed().subscribe(speed => {
                  this.speed = speed;
                });
                this.textsLength = this.sp.getTextsLenght();
                this.initialized = true;
              });
          }

          this.db.getAuthor(book.creatorId).then(author => {
            this.authorName = author.name + ' ' + author.surname;
          });
          this.initialized = true;
        }).catch(e => {
          console.log('getBook failed: ');
          console.log(e);
        });
      }
    });
  }


  getText() {
    this.fs.readTextFile(this.path).then(str => {
      this.texts = this.sp.getTexts(str);
      this.textsLength = this.texts.length;
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
        this.sp.stopSpeaking();
      } else {
        this.sp.speak();
      }
      this.isSpeaking = !this.isSpeaking;
    }
  }

  backward() {
    if (!this.progress) {
      this.progress = 0;
    }
    if (this.spritzBoolean) {
      this.progress -= 1;
    } else {
      this.sp.changeProgress(this.progress - 1);
    }
    this.stopStartSpeaking();
  }

  forward() {
    if (!this.progress) {
      this.progress = 0;
    }
    if (this.spritzBoolean) {
      this.progress += 1;
    } else {
      this.sp.changeProgress(this.progress + 1);
    }
    this.stopStartSpeaking();
  }

  changeProgress(event) {
    const progress = event.detail.value;
    if (this.spritzBoolean) {
      this.progress = progress;
    } else {
      this.sp.changeProgress(progress);
    }
  }

  stopStartSpeaking() {
    if (!this.spritzBoolean) {
      if (this.isSpeaking) {
        this.sp.stopSpeaking().then(_ => {
          this.sp.speak();
        });
      }
    } else {
      if (this.isSpeaking) {
        this.isSpeaking = false;
      }
      this.sentense = this.texts[this.progress] + '.';
      this.printWord(this.sentense.split(/\ /)[0]);
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
    const speed = this.speed;
    if (speed > 0) {
      if (str === '-') {
        if (this.spritzBoolean) {
          this.speed = speed - 10;
        } else {
          this.sp.changeSpeed(speed - 1);
        }
      } else {
        if (this.spritzBoolean) {
          this.speed = speed + 10;
        } else {
          this.sp.changeSpeed(speed + 1);
        }
      }


      if (this.spritzBoolean) {
        this.strg.set('spritzSpeed', this.speed);
      }
    }
  }


  ngOnDestroy() {
    if (this.texts) {
      this.db.updateBookProgress(this.id, this.progress + '/' + this.texts.length);
    }
  }

}
