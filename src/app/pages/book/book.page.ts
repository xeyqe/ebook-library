import { Component, OnInit } from '@angular/core';
import { DatabaseService, Book } from './../../services/database.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-book',
  templateUrl: './book.page.html',
  styleUrls: ['./book.page.scss'],
})
export class BookPage implements OnInit {
  book: Book = null;

  bookChanged = false;
  fileName: string;
  ready2editing = false;
  bookId: number;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;

  constructor(private route: ActivatedRoute,
              private db: DatabaseService) { }

    ngOnInit() {
      this.route.paramMap.subscribe(params => {
        const bookId = params.get('id');
        const id = parseInt(bookId, 10);
        this.bookId = id;
        this.db.getDatabaseState().subscribe(ready => {
          if (ready) {

            this.db.getBook(id).then(data => {
              this.fileName = data.title;

              this.book = data;
              this.dontworryiwillnameyoulater = this.book.id + '0';
              this.dontworryiwillnameyoulater2 = this.book.id + '1';

            }).catch(e => {
              console.log('getBook failed: ');
              console.log(e);
            });
          }
        });
      });
    }

    updateBook() {
      const bookRating = this.book.rating;
      if (bookRating) {
        this.book.rating = Math.floor(bookRating * 10) / 10;
      }
      if (bookRating > 5) {
        this.book.rating = 5;
      } else if (bookRating < 0) {
        this.book.rating = 0;
      }
      this.db.updateBook(this.book).then(() => {
        this.bookChanged = false;
        this.ready2editing = !this.ready2editing;
      }).catch(e => {
        console.log('updateBook failed: ');
        console.log(e);
      });
    }

    editable() {
      if (this.ready2editing) {
        this.db.getBook(this.bookId).then(book => {
          this.book = book;
        });
      }
      this.ready2editing = !this.ready2editing;
      this.bookChanged = false;
    }

    changeLanguage(lang: any) {
      this.book.language = lang;
      this.bookChanged = true;
    }

}
