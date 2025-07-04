import { Component, ElementRef, inject, OnInit, Renderer2, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { NavController, Platform, ToastController } from '@ionic/angular';

import { Subscription } from 'rxjs';

import { BusyService } from './services/busy.service';
import { FileReaderService } from './services/file-reader.service';
import { DatabaseService } from 'src/app/services/database.service';

import { StatusBar } from '@capacitor/status-bar';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { AllFilesAccess } from 'capacitor-all-files-access-permission';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  @ViewChild('elRef', { static: true }) elRef: ElementRef;
  private lastTimeBackPress = 0;
  private subs: Subscription[] = [];
  protected initialized: boolean;

  private db = inject(DatabaseService);
  private fr = inject(FileReaderService);
  private navCtrl = inject(NavController);
  private platform = inject(Platform);
  private router = inject(Router);
  private renderer = inject(Renderer2);
  private toastCtrl = inject(ToastController);
  protected workingServ = inject(BusyService);

  ngOnInit(): void {
    this.platform.ready().then(() => {
      ForegroundService.requestPermissions().then(a => {
        console.log(a);
      }).catch(e => {
        console.error(e);
      });

      ForegroundService.checkPermissions().then(a => {
        console.log(a);
      }).catch(e => {
        console.error(e);
      });
      this.saveArea();
      AllFilesAccess.access().then(() => {
        this.initializeApp();
        this.setSubs();
        StatusBar.hide();
      })
    }).catch(e => {
      console.error('getting platform ready failed');
      console.error(e);
    })
  }

  private saveArea(): void {
    SafeArea.setImmersiveNavigationBar();
    SafeArea.getSafeAreaInsets().then((result) => {
      this.setSaveAreaMargin(result.insets);
    });
    SafeArea.addListener('safeAreaChanged', (result) => {
      this.setSaveAreaMargin(result.insets);
    });
  }

  private setSaveAreaMargin(
    saveArea: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }
  ): void {
    this.renderer.setStyle(
      this.elRef.nativeElement || this.elRef[`el`],
      'margin',
      `${saveArea.top}px ${saveArea.right}px ${saveArea.bottom}px ${saveArea.left}px`
    );
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
      await this.fr.downloadDorian();
    } catch (e) {
      console.error(e);
    }

    try {
      await this.fr.listOfAuthors();
      this.initialized = true;
      console.log('this.fr.listOfAuthors() finished')
    } catch (e) {
      console.error('this.fr.listOfAuthors() failed');
      console.error(e);
    }
  }

  private setSubs() {
    this.subs.push(this.platform.backButton.subscribeWithPriority(9999, () => {
      this.hwBackButtonFunction();
    }));
    this.subs.push(this.platform.resume.subscribe(() => {
      if (this.workingServ.isSpeaking) {
        this.workingServ.inBg = true;
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
        this.db.getAuthor(book.creatorIds[0]).then((author) => {
          const authorId = author.id + '';
          this.router.navigate(['/author', authorId]);
        });
      });
    } else if (/^\/tts\/[0-9]+;type=[a-z]+$/.test(url)) {
      const bookId = url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf(';'));
      this.router.navigate(['/book', bookId]);
    } else {
      this.navCtrl.back();
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
