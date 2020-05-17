import { Component, OnInit } from '@angular/core';
import { DatabaseService, Book } from './../../services/database.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';
import { FileReaderService } from 'src/app/services/file-reader.service';


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
  jsonBooks;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;

  constructor(
    private route: ActivatedRoute,
    private db: DatabaseService,
    private router: Router,
    private dialog: Dialogs,
    private jsonServ: JsonDataParserService,
    private fs: FileReaderService
  ) { }

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
              console.log(this.book);
              this.getAuthorsBooks();
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

    deleteBook() {
      this.dialog.confirm('Do you really want to delete this book?\n(A file won\'t be deleted.)',
                           null, ['Ok', 'Cancel']).then(res => {
        if (res === 1) {
          const bookId = this.book.id;
          const authorId = this.book.creatorId;
          this.db.deleteBook(bookId, authorId).then(_ => {
            this.router.navigate(['/author', authorId]);
          });
        }
      });
    }

    getAuthorsBooks() {
      const authorsId = this.book.creatorId;
      this.db.getAuthor(authorsId).then(author => {
        const authorsIdInJson = author.idInJson;
        if (authorsIdInJson) {
          let jsonAuthor = this.jsonServ.getAuthor(authorsIdInJson);
          if (jsonAuthor) {
            this.jsonBooks = jsonAuthor.books;
          } else {
            this.jsonServ.jsonAuthorsData().then(_ => {
              jsonAuthor = this.jsonServ.getAuthor(authorsIdInJson);
              if (jsonAuthor) {
                this.jsonBooks = jsonAuthor.books;
              }
            });
          }
        }
      });
    }

    getBookData(index: string) {
      let jsonBook = this.jsonServ.getBook(index);
      if (jsonBook) {
        this.fillData(jsonBook);
      } else {
        this.jsonServ.jsonBooksData().then(() => {
          jsonBook = this.jsonServ.getBook(index);
          this.fillData(jsonBook);
        });
      }
    }

    fillData(jsonBook) {
      console.log(jsonBook);
      this.book.title = jsonBook.title;
      this.book.originalTitle = jsonBook.originalTitle;
      this.book.genre = jsonBook.genre;
      this.book.ISBN = jsonBook.isbn;
      this.book.publisher = jsonBook.publisher;
      this.book.published = jsonBook.published;
      this.book.language = jsonBook.language;
      this.book.translator = jsonBook.translator;
      this.book.length = jsonBook.pages;
      this.book.annotation = jsonBook.annotation;
      this.book.img = jsonBook.img;

      this.bookChanged = true;
    }

    downloadPicture() {
      this.db.getAuthor(this.book.creatorId).then(author => {
        const uri = this.book.img;
        const path = author.path;
        const index = this.book.img.lastIndexOf('.');
        const extension = this.book.img.substring(index);
        const filename = this.book.title + extension;
  
        this.fs.downloadPicture(uri, path, filename).then(src => {
          console.log('changing img now to: ' + src);
          this.book.img = src;
          this.bookChanged = true;
        }).catch(e => {
          alert(e);
        });
      })
    }

}
