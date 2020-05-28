import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';

import { DatabaseService, Author, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';


@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
})
export class AuthorsPage implements OnInit {

  authors: Author[] = [];
  books: Book[] = [];
  author = {};
  lastListenedBookId: string;
  subscribtion;
  hideCharacters = false;
  where2Search = ['A', 'B'];
  where2SearchIndex = 0;

  selectedView = 'TODO';
  filterStatus = '';
  alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
              'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q',
              'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];
  selectedCharacter = 'A';

  constructor(
    private db: DatabaseService,
    private fr: FileReaderService,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        this.db.getAuthors().subscribe(authors => {
          this.authors = authors;
        });
        this.db.getAllBooks().subscribe(books => {
          this.books = books;
        })
        this.platform.ready().then(() => {
          this.fr.createApplicationFolder();
          this.fr.listOfAuthors();
        }).catch(e => {
          console.log('plt.ready failed: ');
          console.log(e);
        });
      }
    });
  }

  ionViewWillEnter() {
    this.db.getValue('as').then(data => {
      data ? this.lastListenedBookId = data : this.lastListenedBookId = '10';
    });
    this.db.getValue('where2SearchIndex').then(data => {
      data ? this.where2SearchIndex = parseInt(data, 10) : this.where2SearchIndex = 0;
    });
  }

  changeSelectedChar(character: string) {
    if (character.length === 1) {
      this.selectedCharacter = character;
    }
  }

  where2SearchFn() {
    this.where2SearchIndex =  (this.where2SearchIndex + 1) % this.where2Search.length;
  }


}
