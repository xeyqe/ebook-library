import { signal, ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import { NavController, Platform, ToastController } from '@ionic/angular';

import { Subscription } from 'rxjs';

import { BusyService } from './services/busy.service';
import { FileReaderService } from './services/file-reader.service';
import { DatabaseService } from 'src/app/services/database.service';

import { StatusBar } from '@capacitor/status-bar';
import { SafeArea, SafeAreaInsets } from 'capacitor-plugin-safe-area';
import { AllFilesAccess } from 'capacitor-all-files-access-permission';
import { LibraryBackupService } from './services/library-backup.service';
import { TTS_PLUGIN } from './services/tts-plugin';

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  @ViewChild('elRef', { static: true }) elRef: ElementRef;
  private lastTimeBackPress = 0;
  private subs: Subscription[] = [];
  protected readonly initialized = signal<boolean>(undefined);

  protected readonly backup = inject(LibraryBackupService);
  private tts = inject(TTS_PLUGIN);
  private db = inject(DatabaseService);
  private fr = inject(FileReaderService);
  private navCtrl = inject(NavController);
  private platform = inject(Platform);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  protected workingServ = inject(BusyService);

  ngOnInit(): void {
    this.platform
      .ready()
      .then(() => {
        if (this.platform.is('android')) {
          // TTS manages playback and requests its foreground notification permission.
          this.tts.requestForegroundPermissions().catch((e) => {
            console.error('Requesting TTS foreground notification permission failed', e);
          });
        }
        this.saveArea();
        AllFilesAccess.access().then(() => {
          this.initializeApp();
          this.setSubs();
          StatusBar.hide();
        });
      })
      .catch((e) => {
        console.error('getting platform ready failed');
        console.error(e);
      });
  }

  private saveArea(): void {
    SafeArea.setImmersiveNavigationBar();
    SafeArea.getSafeAreaInsets().then((result) => {
      this.setSaveAreaMargin(result);
    });
    SafeArea.addListener('safeAreaChanged', (result) => {
      this.setSaveAreaMargin(result);
    });
  }

  private setSaveAreaMargin(data: SafeAreaInsets): void {
    const { insets } = data;
    for (const [key, value] of Object.entries(insets)) {
      const el = this.elRef.nativeElement || document.querySelector('ion-app');
      el.style.setProperty(`margin-${key}`, `${value}px`);
    }
  }

  private async initializeApp(): Promise<void> {
    try {
      await this.db.initializeDB();
      await this.backup.recoverInterruptedRestore();
      console.log('dt initialized');
    } catch (e) {
      console.log('this.db.initializeDB() failed');
      console.error(e);
      const toast = await this.toastCtrl.create({
        message: 'Unable to open the library. Restart the app to retry recovery.',
        buttons: ['OK'],
      });
      await toast.present();
      return;
    }
    try {
      await this.fr.createApplicationFolder();
      console.log('this.fr.createApplicationFolder() finished');
    } catch (e) {
      console.error('download of dorian failed');
      console.error(e);
    }
    try {
      await this.fr.downloadDorian();
    } catch (e) {
      console.error(e);
    }

    try {
      await this.fr.listOfAuthors();
      this.initialized.set(true);
      console.log('this.fr.listOfAuthors() finished');
    } catch (e) {
      console.error('this.fr.listOfAuthors() failed');
      console.error(e);
    }
  }

  private setSubs() {
    this.subs.push(
      this.platform.backButton.subscribeWithPriority(9999, () => {
        this.hwBackButtonFunction();
      }),
    );
    this.subs.push(
      this.platform.resume.subscribe(() => {
        if (this.workingServ.isSpeaking()) {
          this.workingServ.inBg.set(true);
        }
      }),
    );
  }

  private hwBackButtonFunction(): void {
    if (this.workingServ.working() || this.backup.active()) return;
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
