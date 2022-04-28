import { Component, OnInit, OnDestroy } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { Capacitor } from '@capacitor/core';
import { Encoding, Filesystem } from '@capacitor/filesystem';

import { Subscription } from 'rxjs';
import { first, debounceTime } from 'rxjs/operators';

import { SplashScreen } from '@capacitor/splash-screen';

import { DatabaseService } from './../../services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from './../../services/file-reader.service';

import { DialogComponent } from 'src/app/material/dialog/dialog.component';

import { BOOKSIMPLIFIED, AUTHORSIMPLIFIED } from 'src/app/services/interfaces';
import { FormControl } from '@angular/forms';
import { BusyService } from 'src/app/services/busy.service';


@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
})
export class AuthorsPage implements OnInit, OnDestroy {
  authors: AUTHORSIMPLIFIED[] = [];
  books: BOOKSIMPLIFIED[] = [];
  author: AUTHORSIMPLIFIED;
  lastListenedBookId: string;
  hideCharacters = false;
  where2Search: string;

  selectedView = 'TODO';
  alphabet = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#',
  ];
  selectedCharacter: string;

  private subs: Subscription[] = [];
  imgPreLink: string;
  searchFc: FormControl;


  constructor(
    private db: DatabaseService,
    private dialog: MatDialog,
    private dir: DirectoryService,
    private fr: FileReaderService,
    private workingServ: BusyService,
  ) { }

  ngOnInit() {
    this.searchFc = new FormControl();
    this.subs.push(this.db.getDatabaseState().subscribe(async (ready) => {
      if (ready) {
        this.imgPreLink = this.dir.imgPreLink;
        this.subs.push(this.db.getAuthors().subscribe((authors) => {
          this.authors = authors;
        }));
        this.subs.push(this.db.getAllBooks().subscribe((books) => {
          this.books = books;
        }));
      }
    }));
    this.subs.push(this.searchFc.valueChanges.pipe(debounceTime(200)).subscribe(val => {
      if (!val) {
        this.onSearchClear();
        return;
      }
      if (val.length < 3) return;
      if (this.where2Search === 'A') {
        this.db.findAuthors(val);
      } else {
        this.db.findBooks(val);
      }
    }));
  }

  async ionViewWillEnter() {
    const as = await this.db.getValue('as');
    this.lastListenedBookId = as || '10';

    const where2Search = await this.db.getValue('where2Search');
    this.where2Search = where2Search || 'A';

    const character = await this.db.getValue('character');
    this.selectedCharacter = character || 'W';

    if (this.where2Search === 'A') {
      this.authors = this.db.getAuthors().getValue();
      if (!this.authors.length) this.db.loadAuthors(this.selectedCharacter);
    } else {
      this.books = this.db.getAllBooks().getValue();
      if (!this.books.length)  this.db.loadBooks('started');
    }
    SplashScreen.hide();
  }

  changeSelectedChar(type: string, whichOne: 'authors' | 'books') {
    this.db.saveValue('character', type);
    this.selectedCharacter = type;
    whichOne === 'authors' ? this.db.loadAuthors(type) : this.db.loadBooks(type as any);
  }

  where2SearchFn() {
    if (this.where2Search === 'A') {
      this.where2Search = 'B';
      this.selectedCharacter = 'liked';
    } else {
      this.where2Search = 'A';
      this.selectedCharacter = 'A';
    }
    this.db.saveValue('character', this.selectedCharacter);
    this.db.saveValue('where2Search', this.where2Search);
  }

  onShowDialog() {
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
        this.exportDB();
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
          selects: files.map(fl => fl.replace('ebook-library/', '')),
        }
      }
    );
    dialogRef.afterClosed().pipe(first()).subscribe((selected) => {
      this.importJson2DB(files[selected]);
    });
  }

  private async exportDB() {
    this.workingServ.busy();
    const json = await this.db.exportDB();
    const version = await this.db.getVersion();
    await this.fr.write2File(JSON.stringify(json), version).catch(e => {
      console.error('write2File failed!');
      this.workingServ.done();
      throw new Error(JSON.stringify(e));
    });
    this.workingServ.done();
  }

  private async importJson2DB(path: string) {
    this.workingServ.busy();
    const json = await Filesystem.readFile({
      directory: this.dir.dir,
      path,
      encoding: Encoding.UTF8
    });
    await this.db.importDB(json.data);
    this.workingServ.done();
  }

  onImgIsLocal(path: string) {
    return path.startsWith('/');
  }

  onGetImgSrc(img: string) {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  onSearchClear() {
    if (this.where2Search === 'A') {
      this.db.loadAuthors(this.selectedCharacter);
    } else {
      this.db.loadBooks(this.selectedCharacter as any);
    }
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
  }
}
