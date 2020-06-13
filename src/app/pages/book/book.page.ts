import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { DatabaseService, Book } from './../../services/database.service';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { IonContent } from '@ionic/angular';

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
  showAble = false;

  onlineBookList;

  isWorking = false;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;

  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target') target: any;

  constructor(
    private route: ActivatedRoute,
    private db: DatabaseService,
    private router: Router,
    private dialog: Dialogs,
    private jsonServ: JsonDataParserService,
    private fs: FileReaderService,
    private webScrapper: WebScraperService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const bookId = params.get('id');
      const id = parseInt(bookId, 10);
      this.bookId = id;
      this.db.getDatabaseState().subscribe((ready) => {
        if (ready) {
          this.db
            .getBook(id)
            .then((data) => {
              this.fileName = data.title;
              this.book = data;
              this.getAuthorsBooks();
              this.dontworryiwillnameyoulater = this.book.id + '0';
              this.dontworryiwillnameyoulater2 = this.book.id + '1';
            })
            .catch((e) => {
              console.log('getBook failed: ');
              console.log(e);
            });
        }
      });
      this.showAble = this.webScrapper.showable;
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
    this.db
      .updateBook(this.book)
      .then(() => {
        this.bookChanged = false;
        this.ready2editing = !this.ready2editing;
      })
      .catch((e) => {
        console.log('updateBook failed: ');
        console.log(e);
      });
  }

  editable() {
    if (this.ready2editing) {
      this.db.getBook(this.bookId).then((book) => {
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
    this.dialog
      .confirm('Do you really want to delete this book?\n(A file won\'t be deleted.)', null, ['Ok', 'Cancel'])
      .then((res) => {
        if (res === 1) {
          const bookId = this.book.id;
          const authorId = this.book.creatorId;
          this.db.deleteBook(bookId, authorId).then((_) => {
            this.router.navigate(['/author', authorId]);
          });
        }
      });
  }

  getAuthorsBooks() {
    const authorsId = this.book.creatorId;
    this.db.getAuthor(authorsId).then((author) => {
      const authorsIdInJson = author.idInJson;
      if (authorsIdInJson) {
        let jsonAuthor = this.jsonServ.getAuthor(authorsIdInJson);
        if (jsonAuthor) {
          this.jsonBooks = jsonAuthor.books;
        } else {
          this.jsonServ.jsonAuthorsData().then((_) => {
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
      this.isWorking = true;
      this.jsonServ.jsonBooksData().then(() => {
        this.isWorking = false;
        jsonBook = this.jsonServ.getBook(index);
        this.fillData(jsonBook);
      });
    }
  }

  fillData(jsonBook) {
    this.book.img = this.book.img || jsonBook.img;
    // this.book.title = this.book.title || jsonBook.title;
    this.book.title = jsonBook.title;
    this.book.originalTitle = this.book.originalTitle || jsonBook.originalTitle;
    this.book.genre = this.book.genre || jsonBook.genre;
    this.book.publisher = this.book.publisher || jsonBook.publisher;
    this.book.published = this.book.published || jsonBook.published;
    this.book.annotation = this.book.annotation || jsonBook.annotation;
    this.book.ISBN = this.book.ISBN || jsonBook.isbn;
    this.book.language = this.book.language || jsonBook.language;
    this.book.translator = this.book.translator || jsonBook.translator;
    this.book.length = this.book.length || jsonBook.pages;

    this.bookChanged = true;
  }

  downloadPicture() {
    this.db.getAuthor(this.book.creatorId).then((author) => {
      const uri = this.book.img;
      const path = '/ebook-library';
      const index = this.book.img.lastIndexOf('.');
      const extension = this.book.img.substring(index);
      const filename = author.path.substring(14) + this.book.title + extension;

      this.isWorking = true;
      this.fs
        .downloadPicture(uri, path, filename)
        .then((src) => {
          this.isWorking = false;
          this.book.img = src;
          this.bookChanged = true;
        })
        .catch((e) => {
          alert(e);
        });
    });
  }

  getBooksList() {
    this.db.getAuthor(this.book.creatorId).then((author) => {
      let authorsName = author.name + ' ' + author.surname;
      if (authorsName[0] === ' ') {
        authorsName = authorsName.replace(' ', '');
      }
      if (authorsName.length) {
        this.isWorking = true;
        this.webScrapper.getBooksList(authorsName).then((data) => {
          this.isWorking = false;
          this.onlineBookList = data;
          this.scrollElement();
        });
      }
    });
  }

  downloadBookInfo(link: string) {
    this.isWorking = true;
    this.webScrapper.getBook(link).then((data) => {
      this.isWorking = false;
      if (data) {
        this.book.img = this.book.img || data.img;
        this.book.title = this.book.title || data.title;
        this.book.originalTitle = this.book.originalTitle || data.originalTitle;
        this.book.genre = this.book.genre || data.genre;
        this.book.publisher = this.book.publisher || data.publisher;
        this.book.published = this.book.published || data.published;
        this.book.annotation = this.book.annotation || data.annotation;

        this.bookChanged = true;
        this.content.scrollToTop();
      }
    });
  }

  private scrollElement() {
    this.content.scrollToPoint(0, this.target.nativeElement.offsetTop, 500);
  }
}
