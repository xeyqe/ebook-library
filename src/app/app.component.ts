import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Storage } from '@ionic/storage-angular';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Platform, ToastController } from '@ionic/angular';
import { BackgroundMode } from 'capacitor-plugin-background-mode';

import { FileReaderService } from './services/file-reader.service';
import { DatabaseService } from 'src/app/services/database.service';
import { BusyService } from './services/busy.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private db: DatabaseService,
    private fr: FileReaderService,
    private platform: Platform,
    private router: Router,
    private statusBar: StatusBar,
    private toastCtrl: ToastController,
    public storage: Storage,
    public workingServ: BusyService,
  ) {
    this.initializeApp();
  }

  lastTimeBackPress = 0;

  initializeApp() {
    this.platform.ready().then(async () => {
      await this.db.initializeDB();
      this.fr.createApplicationFolder();
      this.fr.listOfAuthors();
      this.statusBar.styleDefault();

      BackgroundMode.setSettings({
        title: 'author',
        text: 'book',
        icon: 'ic_launcher',
        color: 'F14F4D',
        resume: true,
        hidden: false,
        bigText: true
      });

      this.platform.backButton.subscribeWithPriority(9999, () => {
        this.hwBackButtonFunction();
      });
      this.platform.resume.subscribe(() => {
        BackgroundMode.disable();
      });
      this.platform.pause.subscribe(() => {
        this.db.getValue('isSpeaking').then(value => {
          if (value) {
            BackgroundMode.enable();
            this.db.getValue('author').then(author => {
              this.db.getValue('title').then(title => {
                BackgroundMode.setSettings({
                  title: author,
                  text: title,
                  icon: 'ic_launcher',
                  color: 'F14F4D',
                  resume: true,
                  hidden: false,
                  bigText: true
                });
              });
            });
          }
        });
      });
    });
  }

  hwBackButtonFunction() {
    const url = this.router.url;

    if (url === '/authors') {
      if (this.lastTimeBackPress + 2000 > new Date().getTime()) {
        navigator['app'].exitApp();
      } else {
        this.lastTimeBackPress = new Date().getTime();
        this.presentToast();
      }
    } else if (/^(\/author\/[0-9]+)$/.test(url)) {
      this.router.navigate(['/authors']);
    } else if (/^(\/book\/[0-9]+)$/.test(url)) {
      const bookId = parseInt(url.substring(url.lastIndexOf('/') + 1), 10);
      this.db.getBook(bookId).then((book) => {
        this.db.getAuthor(book.creatorId).then((author) => {
          const authorId = author.id + '';
          this.router.navigate(['/author', authorId]);
        });
      });
    } else if (/^(\/tts\/[0-9]+)$/.test(url)) {
      const bookId = url.substring(url.lastIndexOf('/') + 1, url.length - 1);
      this.router.navigate(['/book', bookId]);
    } else {
      console.error('else ?');
    }
  }

  async presentToast() {
    const toast = await this.toastCtrl.create({
      message: 'Press back again to exit.',
      duration: 2000,
    });
    toast.present();
  }
}
