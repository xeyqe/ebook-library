import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Platform, ToastController } from '@ionic/angular';

import { StatusBar } from '@awesome-cordova-plugins/status-bar/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';

import { BusyService } from './services/busy.service';
import { FileReaderService } from './services/file-reader.service';
import { DatabaseService } from 'src/app/services/database.service';
import { Subscription } from 'rxjs';
import { WebIntent } from '@awesome-cordova-plugins/web-intent/ngx';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  protected initialized: boolean;
  private lastTimeBackPress = 0;
  private subs: Subscription[] = [];

  constructor(
    private backgroundMode: BackgroundMode,
    private db: DatabaseService,
    private fr: FileReaderService,
    private platform: Platform,
    private router: Router,
    private statusBar: StatusBar,
    private toastCtrl: ToastController,
    private webIntent: WebIntent,
    protected workingServ: BusyService,
  ) { }

  ngOnInit(): void {
    this.platform.ready().then(async () => {
      const options = {
        action: this.webIntent[`ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION`],
        url: `package:io.ionic.starter`
      }     
      if (!await this.fr.accessAllFilesPermissionGranted()) 
        await this.webIntent.startActivity(options).then((a) => {console.log(a)}, (e) => {console.error(e)});

      this.fr.downloadDorian();
      this.initializeApp();
      this.setSubs();
      this.statusBar.hide();
    }).catch(e => {
      console.error('getting platform ready failed');
      console.error(e);
    })
  }

  private async initializeApp(): Promise<void> {
    try {
      await this.db.initializeDB();
      console.log('dt initialized');
    } catch (e) {
      console.log('this.db.initializeDB() failed')
      console.error(e)
    }
    try {
      await this.fr.createApplicationFolder();
      console.log('this.fr.createApplicationFolder() finished')
    } catch (e) {
      console.error('download of dorian failed')
      console.error(e)
    }
    try {
      await this.fr.listOfAuthors();
      this.initialized = true;
      console.log('this.fr.listOfAuthors() finished')
    } catch (e) {
      console.error('this.fr.listOfAuthors() failed');
      console.error(e);
    }

    this.backgroundMode.setDefaults({
      title: 'author',
      text: 'book',
      icon: 'ic_launcher',
      color: 'F14F4D',
      resume: true,
      hidden: false,
      bigText: true
    });
  }

  private setSubs() {
    this.subs.push(this.platform.backButton.subscribeWithPriority(9999, () => {
      this.hwBackButtonFunction();
    }));
    this.subs.push(this.platform.resume.subscribe(() => {
      if (this.workingServ.isSpeaking) {
        this.workingServ.inBg = true;
        this.backgroundMode.disable();
      }
    }));
    this.subs.push(this.platform.pause.subscribe(() => {
      if (this.workingServ.isSpeaking) {
        this.workingServ.inBg = false;
        // this.backgroundMode.disableBatteryOptimizations();
        this.backgroundMode.disableWebViewOptimizations();
        this.backgroundMode.enable();

        Promise.all([
          this.db.getValue('author'),
          this.db.getValue('title'),
        ]).then(dt => {
          this.backgroundMode.setDefaults({
            title: dt[0],
            text: dt[1],
            icon: 'ic_launcher',
            color: 'F14F4D',
            resume: true,
            hidden: false,
            bigText: true
          });
        });
      }
    }));
  }

  private hwBackButtonFunction(): void {
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

  private async presentToast(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'Press back again to exit.',
      duration: 2000,
    });
    toast.present();
  }
}
