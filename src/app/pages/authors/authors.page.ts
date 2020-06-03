import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';

import { DatabaseService } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';

@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
})
export class AuthorsPage implements OnInit {
  authors: { id: number; name: string; surname: string; img: string }[] = [];
  books: {
    id: number;
    title: string;
    img: string;
    progress: string;
    rating: number;
  }[] = [];
  author = {};
  lastListenedBookId: string;
  subscribtion;
  hideCharacters = false;
  where2Search: string;

  selectedView = 'TODO';
  filterStatus = '';
  alphabet = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    '#',
  ];
  selectedCharacter: string;

  constructor(private db: DatabaseService, private fr: FileReaderService, private platform: Platform) {}

  ngOnInit() {
    this.db.getDatabaseState().subscribe((ready) => {
      if (ready) {
        this.db.getAuthors().subscribe((authors) => {
          this.authors = authors;
        });
        this.db.getAllBooks().subscribe((books) => {
          this.books = books;
        });
        this.platform
          .ready()
          .then(() => {
            this.fr.createApplicationFolder();
            this.fr.listOfAuthors();
          })
          .catch((e) => {
            console.log('plt.ready failed: ');
            console.log(e);
          });
      }
    });
  }

  ionViewWillEnter() {
    this.db.getValue('as').then((data) => {
      data ? (this.lastListenedBookId = data) : (this.lastListenedBookId = '10');
    });
    this.db.getValue('where2Search').then((data) => {
      data ? (this.where2Search = data) : (this.where2Search = 'A');
    });
    this.db.getValue('character').then((data) => {
      data ? (this.selectedCharacter = data) : (this.selectedCharacter = 'A');
    });
  }

  changeSelectedChar(character: string) {
    this.db.saveValue('character', character);
    this.selectedCharacter = character;
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
}
