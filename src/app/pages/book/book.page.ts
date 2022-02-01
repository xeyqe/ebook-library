import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { Subscription } from 'rxjs';

import { File } from '@ionic-native/file/ngx';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { EpubService } from 'src/app/services/epub.service';
import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';
import { BOOK, ONLINEBOOKLINK, INDEXOFBOOK } from 'src/app/services/interfaces.service';


@Component({
  selector: 'app-book',
  templateUrl: './book.page.html',
  styleUrls: ['./book.page.scss'],
})
export class BookPage implements OnInit, OnDestroy {
  book: BOOK = null;

  bookChanged = false;
  fileName: string;
  ready2editing = false;
  bookId: number;
  jsonBooks: INDEXOFBOOK[];
  showAble = false;

  onlineBookList: ONLINEBOOKLINK[];

  isWorking = false;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;

  databaseSubscribtion: Subscription;

  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target') target: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private db: DatabaseService,
    private router: Router,
    private dialog: Dialogs,
    private jsonServ: JsonDataParserService,
    private fs: FileReaderService,
    private webScrapper: WebScraperService,
    private epub: EpubService,
    private file: File,
    private webView: WebView,
    private iab: InAppBrowser,
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const bookId = params.get('id');
      const id = parseInt(bookId, 10);
      this.bookId = id;
      this.databaseSubscribtion = this.db.getDatabaseState().subscribe((ready) => {
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
      this.showAble = this.webScrapper.showAble;
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

  changeLanguage(lang: string) {
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

  getBookData(index: any) {
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
      const path = this.book.path.substring(0, this.book.path.lastIndexOf('/') + 1);
      const index = this.book.img.lastIndexOf('.');
      const extension = this.book.img.substring(index);
      const filename = this.book.title + extension;

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
    // this.getBook2(link).then((data) => {
    //   this.isWorking = false;
    //   if (data) {
    //     this.book.img = this.book.img || data.img;
    //     this.book.title = this.book.title || data.title;
    //     this.book.originalTitle = this.book.originalTitle || data.originalTitle;
    //     this.book.genre = this.book.genre || data.genre.toString(); // TODO
    //     this.book.publisher = this.book.publisher || data.publisher;
    //     this.book.published = this.book.published || data.published;
    //     this.book.annotation = this.book.annotation || data.annotation;
    //     this.book.language = this.book.language || data.language;
    //     this.book.translator = this.book.translator || data.translator;
    //     this.book.ISBN = this.book.ISBN || data.isbn;

    //     this.bookChanged = true;
    //     this.content.scrollToTop();
    //   }
    // });
    this.getBook2(link).then((data) => {
      if (data) {
        const noise = '...celý text';
        this.book.img = data?.img;
        this.book.title = data?.title;
        this.book.originalTitle = data?.originalTitle;
        this.book.genre = data?.genre?.toString(); // TODO
        this.book.publisher = data?.publisher;
        this.book.published = data?.published;
        this.book.annotation = data?.annotation?.endsWith(noise) ? data?.annotation?.slice(0, -noise.length) : data?.annotation;
        this.book.language = data?.language && data.language !== 'český' ? null : 'cs-CZ';
        this.book.translator = data?.translator;
        this.book.ISBN = data?.isbn;
        this.book.length = data?.pages;

        this.bookChanged = true;
        this.content.scrollToTop();
      }
    }).finally(() => this.isWorking = false);
  }

  async getBook2(url: string): Promise<{
    annotation: string;
    genre: string;
    img: string;
    language: string;
    originalTitle: string;
    pages: number;
    published: number;
    publisher: string;
    title: string;
    translator: string;
    isbn: string;
  }> {
    return new Promise((resolve, reject) => {
      const target = '_blank';
      const options = 'location=yes,hidden=false,beforeload=yes';
      const browser = this.iab.create(url, target, options);

      browser.on('message').subscribe(e => {
        if (e.data.pages) {
          e.data.pages = +e.data.pages;
        }
        if (e.data.genre) {
          e.data.genre = e.data.genre.split(',');
        }

        resolve(e.data as any);
        browser.close();
      });

      browser.on('loadstop').subscribe(event => {
        browser.executeScript({
          code: `function a(el, i){if(el){if (i == 'click'){el.click()}else{return el[i]}}else{return null}};a(document.querySelector('#abinfo > a'),'click');setTimeout(()=>{var o={annotation:a(document.querySelector('#bdetdesc'),'textContent'),genre:a(document.querySelector('[itemprop=genre]'),'textContent'),img:a(document.querySelector('.kniha_img'),'src'),language:a(document.querySelector('[itemprop=language]'),'innerText'),originalTitle:a(document.querySelector('#bdetail_rest>div.detail_description>h4'),'textContent'),pages:a(document.querySelector('[itemprop=numberOfPages]'),'innerText'),published:a(document.querySelector('[itemprop=datePublished]'),'textContent'),publisher:a(document.querySelector('[itemprop=publisher]'),'innerText'),title:a(document.querySelector('[itemprop=name]'),'innerText'),translator:a(document.querySelector('[itemprop=translator]'),'textContent'),isbn:a(document.querySelector('[itemprop=isbn]'),'innerText')};webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(o))},1000)`
        }).catch(e => {
          browser.close();
          reject(e);
        });
      });
    });
  }

  getMetadataFromEpub() {
    this.epub.getMetadataFromEpub(this.book.path).then((metadata) => {
      if (metadata) {
        if (metadata.annotation) {
          // if (!this.book.annotation) {
          this.book.annotation = metadata.annotation.replace(/<[^>]*>/g, '');
          this.bookChanged = true;
          // }
        }
        if (metadata.isbn) {
          // if (!this.book.ISBN) {
          this.book.ISBN = metadata.isbn;
          this.bookChanged = true;
          // }
        }
        if (metadata.title) {
          // if (!this.book.title) {
          this.book.title = metadata.title;
          this.bookChanged = true;
          // }
        }
        if (metadata.published) {
          // if (!this.book.published) {
          this.book.published = metadata.published;
          this.bookChanged = true;
          // }
        }
        if (metadata.publisher) {
          // if (!this.book.publisher) {
          this.book.publisher = metadata.publisher;
          this.bookChanged = true;
          // }
        }
        if (metadata.imgPath) {
          const path = metadata.imgPath.substring(0, metadata.imgPath.lastIndexOf('/'));
          const filename = metadata.imgPath.substring(metadata.imgPath.lastIndexOf('/') + 1);
          const newPath = this.epub.getRootPath().slice(0, -1) +
            this.book.path.substring(0, this.book.path.lastIndexOf('/') + 1);
          const newFilename = this.book.title + metadata.imgPath.substring(metadata.imgPath.lastIndexOf('.'));
          if (!this.book.img) {
            this.file.copyFile(path, filename, newPath, newFilename).then(() => {
              this.book.img = this.webView.convertFileSrc(newPath + newFilename);
              this.bookChanged = true;
            });
          }
        }
      }
    });
  }

  private scrollElement() {
    this.content.scrollToPoint(0, this.target.nativeElement.offsetTop, 500);
  }

  onRemovePic() {
    if (this.book.img.startsWith('http://localhost/')) {
      this.fs.removeFile(this.book.img.split('ebook-library')[1]).then(() => {
        this.book.img = null;
        this.bookChanged = true;
      }).catch(e => {
        this.dialog.alert('Deleting of pic file failed!', 'Warning', 'OK');
      });
    } else {
      this.book.img = null;
      this.bookChanged = true;
    }
  }

  ngOnDestroy() {
    this.databaseSubscribtion?.unsubscribe();
  }
}
