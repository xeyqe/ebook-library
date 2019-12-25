import { Component, OnInit, OnDestroy } from '@angular/core';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { ActivatedRoute } from '@angular/router';
import { FileReaderService } from './../../services/file-reader.service';
import { DatabaseService } from './../../services/database.service';


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


  constructor(private tts: TextToSpeech,
              private route: ActivatedRoute,
              private fs: FileReaderService,
              private db: DatabaseService) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      let autId = params.get('id');
      if (autId[autId.length - 1] === '0') {
        this.spritzBoolean = false;
        this.speed = 3.00;
      } else {
        this.spritzBoolean = true;
        this.speed = 300;
      }
      this.tts.speak('');
      autId = autId.substring(0, autId.length - 1);
      this.id = parseInt(autId, 10);
    });

    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        this.db.getBook(this.id).then(book => {
          this.path = book.path;
          this.title = book.title;
          this.progress = book.progress;
          this.getText();
        }).catch(e => {
          console.log('getBook failed: ');
          console.log(e);
        });
      }
    });
  }


  getText() {
    this.fs.readTextFile(this.path, this.title).then(str => {
      if (str.includes('\r\n')) {
        this.texts = str.split('\r\n');
        this.dot = '';
      } else {
        this.texts = str.split(/\.\n/g);
        this.dot = '.';
      }
      const countOfWords = str.match(/\S+/g).length;
      const countOfWhiteSpaces = str.match(/\s/g).length;

      const lengthOfText = str.length;
      const lengthWithoutWhiteSpaces = lengthOfText - countOfWhiteSpaces;

      this.averageWordLength = lengthWithoutWhiteSpaces / countOfWords;

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
        this.db.updateBookProgress(this.id, this.progress);
      } else {
        this.speak();
      }
      this.isSpeaking = !this.isSpeaking;
    }
  }

  speak() {
    if (this.texts !== null) {
      this.tts.speak({
        text: this.texts[this.progress] + this.dot,
        locale: 'cs-CZ',
        rate: this.speed}).then(_ => {
          if (this.progress < this.texts.length) {
            this.progress++;
            if (this.progress % 5 === 0) {
              this.db.updateBookProgress(this.id, this.progress);
            }
            this.speak();
          }
        }).catch(reason => {
          console.log(reason);
        });
    }
  }

  backward() {
    const minus = Math.floor(this.texts.length / 10);
    if (minus < this.progress) {
      this.progress -= minus;
      this.stopStartSpeaking();
    }
  }

  forward() {
    const plus = Math.floor(this.texts.length / 10);
    if (plus + this.progress < this.texts.length) {
      this.progress += plus;
      this.stopStartSpeaking();
    }
  }

  changeProgress(event) {
    this.progress = event.detail.value;
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
      const msForOneWord = Math.floor(60000 / this.speed);
      const msForOneCharacter = Math.floor(msForOneWord / this.averageWordLength);

      if (!this.isSpeaking) {
        break;
      }
      const paragraph = this.texts[i];
      slova = paragraph.split(/[\ \n]+/);
      for (const word of slova) {
        if (!this.isSpeaking) {
          break;
        }
        const timeoutMs = word.length * msForOneCharacter < msForOneWord ? msForOneWord : Math.floor(word.length * msForOneCharacter);
        this.printWord(word);
        await  new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, Math.floor(timeoutMs));
        });
      }
      this.progress++;
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
    this.speed = Math.floor(this.speed * 100) / 100;
  }


  ngOnDestroy() {
    this.db.updateBookProgress(this.id, this.progress);
  }

}
