import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { InfiniteScrollCustomEvent, IonSearchbar } from '@ionic/angular';
import { Router } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Encoding, Filesystem } from '@capacitor/filesystem';

import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from './../../services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from './../../services/file-reader.service';

import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { InputDialogComponent } from 'src/app/material/input-dialog/input-dialog.component';

import { BOOKSIMPLIFIED, AUTHORSIMPLIFIED } from 'src/app/services/interfaces';


@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
  animations: [
    trigger('expandCollapse', [
      state('animated', style({
        'transform-origin': 'top', height: '0px'
      })),
      state('default', style({ height: '*' })),
      transition('animated => default', animate('200ms ease-out')),
      transition('default => animated', animate('200ms ease-in'))
    ])
  ],
  standalone: false,
})
export class AuthorsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('seachBarEl') seachBarEl: IonSearchbar;
  private subs: Subscription[] = [];
  private authors: AUTHORSIMPLIFIED[] = [];
  protected _authors: AUTHORSIMPLIFIED[] = [];
  private books: BOOKSIMPLIFIED[] = [];
  protected _books: BOOKSIMPLIFIED[] = [];
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
  private scrollTop = 0;
  protected state: 'default' | 'animated' = 'default';


  constructor(
    private db: DatabaseService,
    private dialog: MatDialog,
    private dir: DirectoryService,
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
    this.ionViewWillEnter();
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

    const searchVal = this.seachBarEl.value;
    if (searchVal) this.search(searchVal);
    else this.load();

    setTimeout(() => {
      const el = document.querySelector('ion-list')?.firstElementChild;
      this.scrollTop = el?.getBoundingClientRect()?.y || 0;
    });
  }

  private async load() {
    if (this.where2Search === 'A') {
      this.authors = await this.db.loadAuthors(this.selectedCharacter || 'W');
      this._authors = this.authors.slice(0, 10);
    } else {
      this.books = await this.db.loadBooks((this.bookSearchBy as any) || 'started');
      this._books = this.books.slice(0, 10);
    }
  }

  protected async changeSelectedChar(value: string, whichOne: 'authors' | 'books') {
    if (whichOne === 'authors') {
      this.db.saveValue('character', value);
      this.selectedCharacter = value;
      this.authors = await this.db.loadAuthors(value);
      this._authors = this.authors.slice(0, 10);
    } else if (whichOne === 'books') {
      this.db.saveValue('bookSearchBy', value);
      this.bookSearchBy = value as any;
      this.books = await this.db.loadBooks(value as any);
      this._books = this.books.slice(0, 10);
    }
  }

  protected async where2SearchFn() {
    if (this.where2Search === 'A') {
      this.where2Search = 'B';
      this.bookSearchBy = this.bookSearchBy || 'liked';
      if (!this._books.length) {
        this.books = await this.db.loadBooks(this.bookSearchBy as any);
        this._books = this.books.slice(0, 10);
      }
    } else {
      this.where2Search = 'A';
      this.selectedCharacter = this.selectedCharacter || 'A';
      if (!this._authors.length) {
        this.authors = await this.db.loadAuthors(this.selectedCharacter as any);
        this._authors = this.authors.slice(0, 10);
      }
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
    await this.db.importDB(json.data as string);
    this.onSearchClear();
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
      this._authors = this.authors.slice(0, 10);
    } else {
      this.books = await this.db.loadBooks(this.bookSearchBy as any);
      this._books = this.books.slice(0, 10);
    }
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
    this.search(val);
  }

  private async search(val: string) {
    if (this.where2Search === 'A') {
      this.authors = await this.db.findAuthors(val);
      this._authors = this.authors.slice(0, 10);
    } else {
      this.books = await this.db.findBooks(val);
      this._books = this.books.slice(0, 10);
    }
  }

  protected onAuthorsIonInfinite(event: InfiniteScrollCustomEvent) {
    if (this._authors.length < this.authors.length)
      this._authors = this.authors.slice(0, this._authors.length + 10);
    event.target.complete();
  }

  protected onBooksIonInfinite(event: InfiniteScrollCustomEvent) {
    if (this._books.length < this.books.length)
      this._books = this.books.slice(0, this._books.length + 10);
    event.target.complete();
  }

  protected onScrollStart(event: Event) {
    if (this.scrollTop > event.target[`firstElementChild`].firstElementChild.getBoundingClientRect().y)
      this.state = 'animated';
    else
      this.state = 'default';
  }

  protected onScrollEnd(event: Event) {
    this.scrollTop = event.target[`firstElementChild`].firstElementChild.getBoundingClientRect().y;
  }

  protected onAddAuthor() {
    this.dialog.open(
      InputDialogComponent,
      {
        data: {
          header: 'Add new author',
        }
      }
    ).afterClosed().subscribe(async response => {
      if (!response) return;
      const path = await this.fr.getUniquePath(`/ebook-library/${response.surname}, ${response.name}/`);
      await Filesystem.mkdir({
        directory: this.dir.dir,
        path,
        recursive: true
      });
      this.db.addAuthor({
        ...response,
        path
      }).then(authorId => {
        this.router.navigate(['/author', authorId]);
      });
    });
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.workingServ.done();
  }

}
