import { Component, OnInit, OnDestroy } from '@angular/core';
import { Platform } from '@ionic/angular';

import { Capacitor } from '@capacitor/core';
import { Encoding, Filesystem } from '@capacitor/filesystem';

import { Subscription } from 'rxjs';

import { SplashScreen } from '@capacitor/splash-screen';

import { DatabaseService } from './../../services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from './../../services/file-reader.service';
import { BOOKSIMPLIFIED, AUTHORSIMPLIFIED } from 'src/app/services/interfaces';


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
  filterStatus = '';
  alphabet = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#',
  ];
  selectedCharacter: string;

  private subs: Subscription[] = [];
  imgPreLink: string;


  constructor(
    private db: DatabaseService,
    private dir: DirectoryService,
    private fr: FileReaderService,
    private platform: Platform,
  ) { }

  ngOnInit() {
    this.subs.push(this.db.getDatabaseState().subscribe(async (ready) => {
      if (ready) {
        this.imgPreLink = this.dir.imgPreLink;
        this.subs.push(this.db.getAuthors().subscribe((authors) => {
          this.authors = authors;
        }));
        this.subs.push(this.db.getAllBooks().subscribe((books) => {
          this.books = books;
        }));
        await this.platform.ready().catch((e) => {
          console.error('plt.ready failed: ');
          console.error(e);
        });
        await this.fr.createApplicationFolder();
        this.fr.listOfAuthors();
        SplashScreen.hide();
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
    this.where2Search === 'A' ? this.db.loadAuthors(this.selectedCharacter) : this.db.loadBooks('started');
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

  onDBExport() {
    this.db.exportDB().then(json => {
      this.fr.write2File(JSON.stringify(json)).catch(e => {
        console.error(e);
      });
    });
  }

  async onJSONImport() {
    const json = await Filesystem.readFile({
      directory: this.dir.dir,
      path: 'ebook-library/db.json',
      encoding: Encoding.UTF8
    });
    this.db.importDB(json.data);
  }

  onImgIsLocal(path: string) {
    return path.startsWith('/');
  }

  onGetImgSrc(img: string) {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
  }
}
