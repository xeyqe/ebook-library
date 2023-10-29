import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Encoding, Filesystem } from '@capacitor/filesystem';
import { FilePath } from '@awesome-cordova-plugins/file-path/ngx';
import { FileChooser } from '@awesome-cordova-plugins/file-chooser/ngx';

import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from './../../services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from './../../services/file-reader.service';

import { DialogComponent } from 'src/app/material/dialog/dialog.component';

import { BOOKSIMPLIFIED, AUTHORSIMPLIFIED } from 'src/app/services/interfaces';


@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
})
export class AuthorsComponent implements OnInit, AfterViewInit, OnDestroy {
  private subs: Subscription[] = [];
  protected authors: AUTHORSIMPLIFIED[] = [];
  protected books: BOOKSIMPLIFIED[] = [];
  protected author: AUTHORSIMPLIFIED;
  protected lastListened: { id: number, type: 'speech' | 'spritz' };
  protected hideCharacters = false;
  protected where2Search: string;
  protected selectedCharacter: string;
  protected selectedView = 'TODO';
  protected imgPreLink: string;
  protected bookSearchBy: 'liked' | 'started' | 'finished';
  protected alphabet = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#',
  ];


  constructor(
    private db: DatabaseService,
    private dialog: MatDialog,
    private dir: DirectoryService,
    private fileChooser: FileChooser,
    private filePath: FilePath,
    private fr: FileReaderService,
    private router: Router,
    private workingServ: BusyService,
  ) { }

  ngOnInit() {
    this.initialize();
  }

  private async initialize() {
    if (!await this.dbIsReady()) return;
    this.imgPreLink = this.dir.imgPreLink;
    this.fr.downloadUnknownImg();
  }

  private dbIsReady(): Promise<boolean> {
    return new Promise((resolve) => {
      this.subs.push(this.db.getDatabaseState().subscribe({
        next: (ready) => {
          resolve(ready);
        },
        error: (error) => {
          console.error(error);
          resolve(false);
        }
      }));
    });
  }

  ngAfterViewInit(): void {
    SplashScreen.hide();
  }

  protected async ionViewWillEnter() {
    const as = await this.db.getValue('as');
    if (!as) {
      this.lastListened = { id: 1, type: 'speech' };
    } else if (/^[\d]+$/.test(as)) {
      this.lastListened = { id: as.slice(0, -1), type: +as.slice(-1) ? 'spritz' : 'speech' }
      this.db.saveValue('as', JSON.stringify(this.lastListened));
    } else {
      this.lastListened = JSON.parse(as);
    }

    const where2Search = await this.db.getValue('where2Search');
    this.where2Search = where2Search || 'A';

    this.selectedCharacter = await this.db.getValue('character');
    this.bookSearchBy = await this.db.getValue('bookSearchBy') as any;

    if (this.where2Search === 'A') {
      this.authors = await this.db.loadAuthors(this.selectedCharacter || 'W');
    } else {
      this.books = await this.db.loadBooks((this.bookSearchBy as any) || 'started');
    }
  }

  protected async changeSelectedChar(value: string, whichOne: 'authors' | 'books') {
    if (whichOne === 'authors') {
      this.db.saveValue('character', value);
      this.selectedCharacter = value;
      this.authors = await this.db.loadAuthors(value);
    } else if (whichOne === 'books') {
      this.db.saveValue('bookSearchBy', value);
      this.bookSearchBy = value as any;
      this.books = await this.db.loadBooks(value as any);
    }
  }

  protected async where2SearchFn() {
    if (this.where2Search === 'A') {
      this.where2Search = 'B';
      this.bookSearchBy = this.bookSearchBy || 'liked';
      if (!this.books.length) this.books = await this.db.loadBooks(this.bookSearchBy as any);
    } else {
      this.where2Search = 'A';
      this.selectedCharacter = this.selectedCharacter || 'A';
      if (!this.authors.length) this.authors = await this.db.loadAuthors(this.selectedCharacter as any);
    }
    this.db.saveValue('character', this.selectedCharacter || 'A');
    this.db.saveValue('bookSearchBy', this.bookSearchBy || 'liked');
    this.db.saveValue('where2Search', this.where2Search);
  }

  protected onShowDialog() {
    const dialogRef = this.dialog.open(
      DialogComponent,
      {
        data: {
          message: 'Choose export/import database.',
          selects: ['EXPORT', 'IMPORT'],
        }
      }
    );
    dialogRef.afterClosed().pipe(first()).subscribe((selected) => {
      if (selected === 0) {
        this.exportDB().finally(() => this.workingServ.done());
      } else if (selected === 1) {
        this.selectWhat2Import();
      }
    });
  }

  private async selectWhat2Import() {
    const files = await this.fr.getDBJsons();
    const dialogRef = this.dialog.open(
      DialogComponent,
      {
        data: {
          message: 'Choose a file to import.',
          selects: files.map(fl => fl.name),
        }
      }
    );
    dialogRef.afterClosed().pipe(first()).subscribe((selected) => {
      console.log(selected)
      if (selected === undefined) return;
      this.importJson2DB(`/ebook-library/` + files[selected].name);
    });
  }

  private async exportDB() {
    this.workingServ.busy();
    const json = await this.db.exportDB();
    const version = await this.db.getVersion();
    await this.fr.write2File(JSON.stringify(json), version).catch(e => {
      console.error('write2File failed!');
      throw e;
    });
  }

  private async importJson2DB(path: string) {
    this.workingServ.busy();
    const json = await Filesystem.readFile({
      directory: this.dir.dir,
      path,
      encoding: Encoding.UTF8
    });
    await this.exportDB();
    await this.db.importDB(json.data as string, this.where2Search || 'A');
    this.workingServ.done();
  }

  protected onImgIsLocal(path: string) {
    return path.startsWith('/');
  }

  protected onGetImgSrc(img: string) {
    if (!img) img = '/ebook-library/unknown.jpg';
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  protected async onSearchClear() {
    if (this.where2Search === 'A') {
      this.authors = await this.db.loadAuthors(this.selectedCharacter);
    } else {
      this.books = await this.db.loadBooks(this.bookSearchBy as any);
    }
  }

  protected async chooseAFile() {
    let nativePath: string;
    try {
      nativePath = await this.fileChooser.open();
    } catch (e) {
      console.error('fileChooser failed');
      console.error(e);
      throw e;
    }
    let path: string;
    try {
      path = await this.filePath.resolveNativePath(nativePath);
    } catch (e) {
      console.error('resolveNativePath failed');
      console.error(e);
      throw e;
    }
    console.log(nativePath);
    console.log(path);
  }

  protected onGo2Last() {
    this.router.navigate(['/tts', this.lastListened.id, { type: this.lastListened.type }]);
  }

  protected async onSearch(event: Event) {
    const val = event.target['value'];
    if (!val) {
      this.onSearchClear();
      return;
    }
    if (val.length < 3) return;
    if (this.where2Search === 'A') this.authors = await this.db.findAuthors(val);
    else this.books = await this.db.findBooks(val);
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.workingServ.done();
  }
}
