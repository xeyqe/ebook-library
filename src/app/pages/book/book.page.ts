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
  oldBook: Book = null;

  bookChanged = false;
  fileName: string;
  ready2editing = false;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;



  constructor(private route: ActivatedRoute,
              private db: DatabaseService) { }

    ngOnInit() {
      this.route.paramMap.subscribe(params => {
        const bookId = params.get('id');
        const id = parseInt(bookId, 10);
        this.db.getDatabaseState().subscribe(ready => {
          if (ready) {

            this.db.getBook(id).then(data => {
              this.fileName = data.title;

              this.book = data;
              this.oldBook = data;
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
      this.db.updateBook(this.book).then(() => {
        this.oldBook = { ...this.book};
        this.bookChanged = false;
        this.ready2editing = !this.ready2editing;
      }).catch(e => {
        console.log('updateBook failed: ');
        console.log(e);
      });
    }

    editable() {
      if (this.ready2editing) {
        this.book = { ...this.oldBook};
      }
      this.ready2editing = !this.ready2editing;
      this.bookChanged = false;
    }

    changeLanguage(lang: any) {
      this.book.language = lang;
      this.bookChanged = true;
    }

}
