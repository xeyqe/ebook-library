import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { FormControl, FormGroup } from '@angular/forms';

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

  private subs: Subscription[] = [];
  bookForm: FormGroup;
  listsOfValues: {
    img: any[],
    title: any[],
    originalTitle: any[],
    genre: any[],
    ISBN: any[],
    publisher: any[],
    published: any[],
    language: any[],
    translator: any[],
    length: any[],
    progress: any[],
    rating: any[],
    annotation: any[],
  };
  _textAreaReduced = true;

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
      this.subs.push(this.db.getDatabaseState().subscribe((ready) => {
        if (ready) {
          this.db.getBook(id).then((data) => {
            this.fileName = data.title;
            this.book = data;
            this.initializeBookForm(data);
            this.initializeSubs();
            this.getAuthorsBooks();
            this.dontworryiwillnameyoulater = this.book.id + '0';
            this.dontworryiwillnameyoulater2 = this.book.id + '1';
          }).catch((e) => {
            console.error('getBook failed: ');
            console.error(e);
          });
        }
      }));
      this.showAble = this.webScrapper.showAble;
    });
  }

  private initializeBookForm(book: BOOK) {
    this.bookForm = new FormGroup({
      img: new FormControl({ value: null, disabled: true }),
      title: new FormControl({ value: null, disabled: true }),
      originalTitle: new FormControl({ value: null, disabled: true }),
      genre: new FormControl({ value: null, disabled: true }),
      ISBN: new FormControl({ value: null, disabled: true }),
      publisher: new FormControl({ value: null, disabled: true }),
      published: new FormControl({ value: null, disabled: true }),
      language: new FormControl({ value: null, disabled: true }),
      translator: new FormControl({ value: null, disabled: true }),
      length: new FormControl({ value: null, disabled: true }),
      progress: new FormControl({ value: null, disabled: true }),
      rating: new FormControl({ value: null, disabled: true }),
      annotation: new FormControl({ value: null, disabled: true }),
    });
    this.listsOfValues = {} as any;
    Object.entries(this.bookForm.controls).forEach(ent => {
      const key = ent[0];
      const fc = ent[1];
      this.listsOfValues[key] = book[key] ? [book[key]] : [];
      fc.setValue(book[key] || null);
    });
    this.removeNotWorkingImg(book.img);
  }

  private removeNotWorkingImg(bookImg: string) {
    if (bookImg && bookImg.startsWith('http://localhost/')) {
      const img = bookImg.split('ebook-library')[1];
      const index = img.lastIndexOf('/') + 1;
      const path = this.file.externalRootDirectory + 'ebook-library';
      this.file.checkFile(path + img.substring(0, index), img.substring(index)).catch((e) => {
        if (e.code === 1) {
          this.bookForm.get('img').setValue(null);
          this.listsOfValues.img = this.listsOfValues.img.filter(img => img !== bookImg);
          this.book.img = null;
          this.db.updateBook(this.book);
        }
      });
    }
  }

  private initializeSubs() {
    this.subs.push(this.bookForm.valueChanges.subscribe(() => {
      this.bookChanged = true;
    }));

  }

  async updateBook() {
    if (this.book.img !== this.bookForm.get('img').value && this.book.img?.startsWith('http://localhost/')) {
      await this.onRemovePic(this.book.img);
    }
    Object.keys(this.bookForm.controls).forEach(key => {
      this.book[key] = this.bookForm.get(key).value;
    });
    this.db.updateBook(this.book).then(() => {
      this.bookChanged = false;
      this.ready2editing = !this.ready2editing;
      Object.entries(this.bookForm.controls).forEach(ent => {
        this.ready2editing ? ent[1].enable({ emitEvent: false }) : ent[1].disable({ emitEvent: false });
      });
    }).catch((e) => {
      console.error('updateBook failed: ');
      console.error(e);
    });
  }

  editable() {
    Object.entries(this.bookForm.controls).forEach(ent => {
      const key = ent[0];
      ent[1].setValue(this.book[key])
    });
    this.ready2editing = !this.ready2editing;
    Object.entries(this.bookForm.controls).forEach(ent => {
      this.ready2editing ? ent[1].enable({ emitEvent: false }) : ent[1].disable({ emitEvent: false });
    });
    this.bookChanged = false;
  }

  async deleteBook() {
    const res = await this.dialog.confirm(
      'Do you really want to delete this book?',
      null,
      ['Ok', 'Cancel']
    );
    if (res === 1) {
      const bookId = this.book.id;
      const authorId = this.book.creatorId;
      await this.onRemovePic(this.book.img);
      await this.removeBookFile();
      this.db.deleteBook(bookId, authorId).then(() => {
        this.router.navigate(['/author', authorId]);
      });
    }
  }

  onRemovePic(img: string) {
    if (img?.startsWith('http://localhost/')) {
      this.fs.removeFile(img.split('ebook-library')[1]).then(() => {
        this.bookForm.get('img').setValue(null);
        this.bookChanged = true;
      }).catch(e => {
        console.error(e)
        this.dialog.alert('Deleting of pic file failed!', 'Warning', 'OK');
      });
    } else {
      this.bookForm.get('img').setValue(null);
      this.bookChanged = true;
    }
  }

  private async removeBookFile() {
    await this.fs.removeFile(this.book.path.split('ebook-library')[1]).catch(e => {
      this.dialog.alert('Deleting of book file failed!', 'Warning', 'OK');
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
          this.jsonServ.jsonAuthorsData().then(() => {
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
      jsonBook[`length`] = jsonBook.pages;
      this.fillData(jsonBook);
    } else {
      this.isWorking = true;
      this.jsonServ.jsonBooksData().then(() => {
        this.isWorking = false;
        jsonBook = this.jsonServ.getBook(index);
        jsonBook[`length`] = jsonBook.pages;
        this.fillData(jsonBook);
      });
    }
  }

  fillData(jsonBook) {
    Object.keys(jsonBook).forEach(key => {
      const val = jsonBook[key];
      const fc = this.bookForm.get(key);
      if (fc) {
        fc.setValue(val || null);
        if (val && !this.listsOfValues[key].includes(val)) {
          this.listsOfValues[key].push(val);
        }
      }
    });
    this.bookChanged = true;
  }

  downloadPicture() {
    const uri = this.bookForm.get('img').value;
    const path = this.book.path.substring(0, this.book.path.lastIndexOf('/') + 1);
    const index = this.bookForm.get('img').value.lastIndexOf('.');
    const extension = this.bookForm.get('img').value.substring(index);
    const filename = this.book.title + extension;

    this.isWorking = true;
    this.fs.downloadPicture(uri, path, filename).then((src) => {
      this.isWorking = false;
      this.bookForm.get('img').setValue(src);
      this.bookChanged = true;
    }).catch((e) => {
      alert(e);
    });
  }

  async getBooksList() {
    const author = await this.db.getAuthor(this.book.creatorId);
    let authorsName = author.name + ' ' + author.surname;
    if (authorsName[0] === ' ') {
      authorsName = authorsName.replace(' ', '');
    }
    if (authorsName.length) {
      this.isWorking = true;
      const data = await this.webScrapper.getBooksListOfAnyAuthor(this.bookForm.get('title').value);
      this.onlineBookList = data.filter(dt => dt.comment.includes(author.surname));
      if (!this.onlineBookList.length) {
        this.onlineBookList = await this.webScrapper.getBooksList(authorsName);
      }
      this.isWorking = false;
      this.scrollElement();
    }
  }

  downloadBookInfo(link: string) {
    this.isWorking = true;

    this.getBook2(link).then((data) => {
      if (data) {
        const noise = '...celý text';
        data.annotation = data.annotation?.endsWith(noise) ?
          data.annotation.slice(0, -noise.length) :
          data.annotation;
        data.language = data.language && data.language !== 'český' ?
          null :
          'cs-CZ';
        data.genre = data.genre?.toString();
        [
          'img', 'title', 'originalTitle', 'genre',
          'publisher', 'published', 'annotation', 'language',
          'translator', 'ISBN', 'length'
        ].forEach(key => {
          if (data[key]) {
            this.bookForm.get(key).setValue(data[key]);
            if (!this.listsOfValues[key].includes(data[key]))
              this.listsOfValues[key].push(data[key]);
          }
        });

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
    length: number;
    published: number;
    publisher: string;
    title: string;
    translator: string;
    ISBN: string;
  }> {
    return new Promise((resolve, reject) => {
      const target = '_blank';
      const options = 'location=yes,hidden=false,beforeload=yes';
      const browser = this.iab.create(url, target, options);

      browser.on('message').subscribe(e => {
        if (e.data.length) {
          e.data.length = +e.data.length;
        }
        if (e.data.genre) {
          e.data.genre = e.data.genre.split(',');
        }

        resolve(e.data as any);
        browser.close();
      });

      browser.on('loadstop').subscribe(event => {
        browser.executeScript({
          code: `function a(el, i){if(el){if (i == 'click'){el.click()}else{return el[i]}}else{return null}};a(document.querySelector('#abinfo > a'),'click');setTimeout(()=>{var o={annotation:a(document.querySelector('#bdetdesc'),'textContent'),genre:a(document.querySelector('[itemprop=genre]'),'textContent'),img:a(document.querySelector('.kniha_img'),'src'),language:a(document.querySelector('[itemprop=language]'),'innerText'),originalTitle:a(document.querySelector('#bdetail_rest>div.detail_description>h4'),'textContent'),length:a(document.querySelector('[itemprop=numberOfPages]'),'innerText'),published:a(document.querySelector('[itemprop=datePublished]'),'textContent'),publisher:a(document.querySelector('[itemprop=publisher]'),'innerText'),title:a(document.querySelector('[itemprop=name]'),'innerText'),translator:a(document.querySelector('[itemprop=translator]'),'textContent'),ISBN:a(document.querySelector('[itemprop=isbn]'),'innerText')};webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(o))},1000)`
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
        metadata.annotation = metadata.annotation?.replace(/<[^>]*>/g, '') || null;
        ['annotation', 'isbn', 'title', 'published', 'publisher'].forEach(key => {
          if (metadata[key]) {
            if (this.bookForm.get(key).value !== metadata[key]) {
              this.bookForm.get(key).setValue(metadata[key]);
              this.bookChanged = true;
            }
            if (!this.listsOfValues[key].includes(metadata[key]))
              this.listsOfValues[key].push(metadata[key]);
          }

        });

        if (metadata.imgPath) {
          const path = metadata.imgPath.substring(0, metadata.imgPath.lastIndexOf('/'));
          const filename = metadata.imgPath.substring(metadata.imgPath.lastIndexOf('/') + 1);
          const newPath = this.epub.getRootPath().slice(0, -1) +
            this.book.path.substring(0, this.book.path.lastIndexOf('/') + 1);
          const newFilename = this.bookForm.get('title').value + metadata.imgPath.substring(metadata.imgPath.lastIndexOf('.'));
          this.file.copyFile(path, filename, newPath, newFilename).then(() => {
            const img = this.webView.convertFileSrc(newPath + newFilename);
            if (this.bookForm.get('img').value !== img) {
              this.bookForm.get('img').setValue(img);
              if (!this.listsOfValues.img.includes(img))
                this.listsOfValues.img.push(img);
              this.bookChanged = true;
            }
          });
        }
      }
    });
  }

  private scrollElement() {
    this.content.scrollToPoint(0, this.target.nativeElement.offsetTop, 500);
  }

  onSwitchPic() {
    if (this.listsOfValues.img.length < 2) return;
    let index = this.listsOfValues.img.indexOf(this.bookForm.get('img').value);
    index = index === -1 ? 0 : (index + 1) % this.listsOfValues.img.length;
    const img = this.listsOfValues.img[index];
    this.bookForm.get('img').setValue(img);
  }

  onReduceHeight() {
    if (this.bookForm.get('annotation').disabled)
      this._textAreaReduced = !this._textAreaReduced;
  }

  onGetWidth(fcName: string, title: string) {
    return {
      width: (String(this.bookForm.get(fcName).value).length * 7 + 2) + 'px',
      'min-width': (title.length * 9.5) + 'px'
    };
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
  }

}
