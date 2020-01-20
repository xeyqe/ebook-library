import { Component } from '@angular/core';

import { Platform, NavController } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Storage } from '@ionic/storage';
import { Router } from '@angular/router';
import { DatabaseService } from './services/database.service';
import { ToastController } from '@ionic/angular';
// import { BackgroundMode } from '@ionic-native/background-mode/ngx';
// import { TtsService } from './services/tts.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    public storage: Storage,
    private router: Router,
    private db: DatabaseService,
    private toastCtrl: ToastController,
    // private bg: BackgroundMode,
    // private sp: TtsService
  ) {
    this.initializeApp();
  }

  lastTimeBackPress = 0;

  initializeApp() {
    this.platform.ready().then(() => {

      this.statusBar.styleDefault();
      this.splashScreen.hide();
      
      this.platform.backButton.subscribeWithPriority(9999, () => {
        this.hwBackButtonFunction();
      });
    });
  }

  hwBackButtonFunction() {
    const url = this.router.url;
    console.log(url);

    if (url === '/authors') {
      if (this.lastTimeBackPress + 2000 > new Date().getTime()) {
        navigator['app'].exitApp();
        // this.bg.moveToBackground();
        // this.bg.on('activate').subscribe(_ => {
        //   this.sp.stopSpeaking().then(_ => {
        //     this.sp.speak();
        //   });
        // });
      } else {
        this.lastTimeBackPress = new Date().getTime();
        this.presentToast();
      }

    } else if (/^(\/author\/[0-9]+)$/.test(url)) {
      this.router.navigate(['/authors']);

    } else if (/^(\/book\/[0-9]+)$/.test(url)) {
      const bookId = parseInt(url.substring(url.lastIndexOf('/') + 1), 10);
      this.db.getBook(bookId).then(book => {
        this.db.getAuthor(book.creatorId).then(author => {
          const authorId = author.id + '';
          this.router.navigate(['/author', authorId]);
        });
      });

    } else if (/^(\/tts\/[0-9]+)$/.test(url)) {
      const bookId = url.substring(url.lastIndexOf('/') + 1, url.length - 1);
      this.router.navigate(['/book', bookId]);
    } else {
      console.log('else ?');
    }
  }

  async presentToast() {
    const toast = await this.toastCtrl.create({
      message: 'Press back again to exit.',
      duration: 2000
    });
    toast.present();
  }
}
