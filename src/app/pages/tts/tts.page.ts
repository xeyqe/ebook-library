import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Storage } from '@ionic/storage';

import { FileReaderService } from 'src/app/services/file-reader.service';
import { DatabaseService } from 'src/app/services/database.service';
import { TtsService } from 'src/app/services/tts.service';

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
    private sp: TtsService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      let bookId = params.get('id');
      this.db.saveValue('as', bookId);
      if (bookId[bookId.length - 1] === '0') {
        this.spritzBoolean = false;
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
      bookId = bookId.substring(0, bookId.length - 1);
      this.id = parseInt(bookId, 10);

      this.sp.stopSpeaking();
    });

    this.db.getDatabaseState().subscribe((ready) => {
      if (ready) {
        this.db
          .getBook(this.id)
          .then((book) => {
            this.path = book.path;
            this.title = book.title;

            if (book.progress) {
              const progressArray = book.progress.split('/');
              this.progress = parseInt(progressArray[0], 10);
            }
            if (this.spritzBoolean) {
              this.getText();
            } else {
              this.sp.startSpeaking(book.id).then((_) => {
                this.sp.getProgress().subscribe((progress) => {
                  this.progress = progress;
                });
                this.speed = this.sp.getSp();
                this.sp.getSpeed().subscribe((speed) => {
                  this.speed = speed;
                });
                this.textsLength = this.sp.getTextsLenght();
                this.initialized = true;
              });
            }

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

  getText() {
    this.fs
      .readTextFile(this.path)
      .then((str) => {
        this.texts = this.sp.getTexts(str);
        this.textsLength = this.texts.length;
        const countOfWords = str.match(/\S+/g).length;
        const countOfWhiteSpaces = str.match(/\s/g).length;

        const lengthOfText = str.length;
        const lengthWithoutWhiteSpaces = lengthOfText - countOfWhiteSpaces;

        this.averageWordLength = lengthWithoutWhiteSpaces / countOfWords;

        if (!this.progress) {
          this.progress = 0;
        }
      })
      .catch((e) => {
        console.log('readTextFile failed: ');
        console.log(e);
      });
  }

  onOff() {
    if (this.spritzBoolean) {
      this.isSpeaking = !this.isSpeaking;
      this.spritz();
    } else {
      if (this.isSpeaking) {
        this.sp.stopSpeaking();
      } else {
        this.sp.speak();
        this.sp.setBookTitle(this.title);
        this.sp.setAuthorName(this.authorName);
      }
      this.isSpeaking = !this.isSpeaking;
    }
  }

  backward() {
    if (!this.progress) {
      this.progress = 0;
    }
    if (this.spritzBoolean && this.progress > 0) {
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
    if (this.spritzBoolean && this.progress < this.texts.length - 1) {
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
        this.sp.stopSpeaking().then((_) => {
          this.sp.speak();
        });
      }
    } else {
      if (this.isSpeaking) {
        this.isSpeaking = false;
      }
      this.sentense = this.texts[this.progress];
      this.spritz();
    }
  }

  redIndexFinder(length: number): number[] {
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

  async spritz() {
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
            await new Promise((resolve) => {
              setTimeout(() => {
                resolve();
              }, timeout);
            });
            addedMs = 0;
            if (slowRegex.test(slovo)) {
              this.printWord(' ', 1);
              addedMs = Math.floor(timeout / 2);
              await new Promise((resolve) => {
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

  printWord(word: string, index: number) {
    this.spritzPreText = word.substring(0, index - 1);
    this.spritzRedText = word[index - 1];
    this.spritzPostText = word.substring(index);
  }

  async waitFn() {
    const ms = 60000 / this.speed;
    await new Promise((resolve) => {
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
          this.sp.changeSpeed(speed - 1);
        }
      }
    } else {
      if (this.spritzBoolean) {
        if (speed < 1000) {
          this.speed = speed + 10;
        }
      } else {
        if (speed < 40) {
          this.sp.changeSpeed(speed + 1);
        }
      }
    }

    if (this.spritzBoolean) {
      this.strg.set('spritzSpeed', this.speed);
    }
  }

  ngOnDestroy() {
    if (this.texts) {
      let progress;
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
