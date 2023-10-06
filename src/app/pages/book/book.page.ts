import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';

import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

import { IonContent } from '@ionic/angular';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';

import { MatDialog } from '@angular/material/dialog';

import { BookService } from './book.service';
import { EpubService } from 'src/app/services/epub.service';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { NonusedPicsService } from '../author/nonused-pics.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';

import { BOOK, ONLINEBOOKLINK, INDEXOFBOOK, AUTHOR, ONLINEAUTHORLEGIE } from 'src/app/services/interfaces';

import { DialogComponent } from 'src/app/material/dialog/dialog.component';


@Component({
  selector: 'app-book',
  templateUrl: './book.page.html',
  styleUrls: ['./book.page.scss'],
})
export class BookComponent implements OnInit, OnDestroy {
  protected book: BOOK = null;

  protected bookChanged = false;
  protected fileName: string;
  protected ready2editing = false;
  protected bookId: number;
  protected jsonBooks: INDEXOFBOOK[];
  protected showAble = false;

  protected onlineBookList: ONLINEBOOKLINK[];
  protected onlineAllBooksList: ONLINEBOOKLINK[];

  protected onlineBookListLegie: ONLINEAUTHORLEGIE[];
  protected onlineShortStoriesListLegie: { title: string, link: string, lgId: string, review: string }[];

  protected onlineBookListCBDB: {
    main: {
      img: string,
      link: string,
      title: string,
      originalTitle: string,
      author: string,
      cbdbId: string,
      authorCbdbId: string
    }[],
    foreign: {
      img: string,
      link: string,
      title: string,
      author: string,
      cbdbId: string,
      authorCbdbId: string
      flag: string,
    }[],
    partly: {
      img: string,
      link: string,
      title: string,
      originTitle: string,
      author: string,
      cbdbId: string,
      authorCbdbId: string
    }[]
  };

  protected onlineBookListOfAuthorCBDB: {
    img: string;
    rating: string;
    title: string;
    link: string;
  }[];

  private subs: Subscription[] = [];
  protected bookForm: FormGroup<{
    img: FormControl<string>,
    title: FormControl<string>,
    originalTitle: FormControl<string>,
    genre: FormControl<string>,
    ISBN: FormControl<string>,
    publisher: FormControl<string>,
    published: FormControl<number>,
    language: FormControl<string>,
    translator: FormControl<string>,
    length: FormControl<number>,
    progress: FormControl<string>,
    rating: FormControl<number>,
    annotation: FormControl<string>,
    serie: FormControl<string>,
    serieOrder: FormControl<number>,
    lgId: FormControl<string>,
    dtbkId: FormControl<string>,
    cbdbId: FormControl<string>,
    added: FormControl<Date>,
    lastRead: FormControl<Date>,
    finished: FormControl<Date>,
  }>;
  protected listsOfValues: {
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
    serie: any[],
    serieOrder: any[],
  };
  protected _textAreaReduced = true;
  protected imgIsLocal: boolean;
  protected imgPreLink: string;

  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target') target: ElementRef;

  constructor(
    private bookServ: BookService,
    private db: DatabaseService,
    private dialog: MatDialog,
    private dir: DirectoryService,
    private epub: EpubService,
    private fs: FileReaderService,
    private iab: InAppBrowser,
    private jsonServ: JsonDataParserService,
    private picsServ: NonusedPicsService,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private router: Router,
    private webScrapper: WebScraperService,
    private workingServ: BusyService,
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const bookId = params.get('id');
      const id = parseInt(bookId, 10);
      this.bookId = id;
      this.subs.push(this.db.getDatabaseState().subscribe((ready) => {
        if (ready) {
          this.db.getBook(id).then((data) => {
            console.log(data)
            this.fileName = data.title;
            this.book = data;
            this.fillOnlineData(data.creatorId);
            this.imgPreLink = this.dir.imgPreLink;
            this.updateOldImgs(data.img);
            this.initializeBookForm(data);
            this.initializeSubs();
            this.getAuthorsBooks();
            if (this.picsServ.pics?.length)
              this.listsOfValues.img = [...this.listsOfValues.img, ...this.picsServ.pics];
            setTimeout(() => {
              Object.keys(this.bookForm.controls).forEach(key => {
                this.updateSize(key);
                this.subs.push(this.bookForm.controls[key].valueChanges.subscribe(() => {
                  this.updateSize(key);
                }));
              });
            }, 1000);
          }).catch((e) => {
            console.error('getBook failed: ');
            console.error(e);
          });
        }
      }));
      this.showAble = this.webScrapper.showAble;
    });
  }

  private updateSize(key: string) {
    if (['serie', 'title', 'originalTitle', 'genre'].includes(key)) return;
    try {
      const field = document.querySelector(`#${key}`);
      if (!field) return;
      const input = field.querySelector('input');
      const label = field.querySelector('.mdc-floating-label');
      input.size = this.bookForm.controls[key].value ? String(this.bookForm.controls[key].value).length + 1 : 1;
      const width = Math.min(window.innerWidth, Math.max(label.getBoundingClientRect().width + 20, input.getBoundingClientRect().width));
      this.renderer.setStyle(field, 'flex-basis', `${Math.floor(width)}px`);
    } catch (e) {
      console.error(e);
    }
  }

  protected delayedUpdateSize(key: string) {
    setTimeout(() => {
      this.updateSize(key);
    }, 200);
  }

  private fillOnlineData(creatorId: number): void {
    if (this.bookServ.onlineData && this.bookServ.onlineData[creatorId]) {
      this.onlineAllBooksList = this.bookServ.onlineData[creatorId].onlineAllBooksList;
      this.onlineBookListLegie = this.bookServ.onlineData[creatorId].onlineBookListLegie;
      this.onlineShortStoriesListLegie = this.bookServ.onlineData[creatorId].onlineShortStoriesListLegie;
    }
  }

  private async updateOldImgs(img: string) {
    if (!img) return;
    if (img.startsWith('http://localhost/_app_file_/storage') || img.startsWith('http://localhost/_capacitor_file_/')) {
      this.book.img = img.replace(/.*\/ebook-library/, '/ebook-library') || null;
      await this.db.updateBook(this.book);
    }
    this.imgIsLocal = this.book.img?.startsWith('/');
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
      serie: new FormControl({ value: null, disabled: true }),
      serieOrder: new FormControl({ value: null, disabled: true }),
      lgId: new FormControl(),
      dtbkId: new FormControl(),
      cbdbId: new FormControl(),
      added: new FormControl(),
      lastRead: new FormControl(),
      finished: new FormControl(),
    });
    this.listsOfValues = {} as any;
    Object.entries(this.bookForm.controls).forEach(ent => {
      const key = ent[0];
      const fc = ent[1];
      this.listsOfValues[key] = book[key] ? [book[key]] : [];
      let value = book[key];
      if (key === 'progress') {
        if (!book[key]) value = '0%';
        else if (book[key] === 'finished') value = '100%';
        else if (book[key].includes('/')) {
          const ar = book[key].split('/');
          value = Math.floor(+ar[0] / +ar[1] * 100) + '%';
        }
      } else if (['added', 'lastRead', 'finished'].includes(key)) {
        value = book[key] ? new Date(book[key]) : null;
      }
      fc.setValue((value || null) as never);
    });
    this.removeNotWorkingImg(book.img);
  }

  private removeNotWorkingImg(bookImg: string) {
    if (bookImg && bookImg.includes('_capacitor_file_')) {
      const img = bookImg.split('ebook-library')[1];

      Filesystem.stat({
        directory: this.dir.dir,
        path: 'ebook-library' + img
      }).catch(() => {
        this.bookForm.get('img').setValue(null);
        this.listsOfValues.img = this.listsOfValues.img.filter(im => im !== bookImg);
        this.book.img = null;
        this.db.updateBook(this.book);
      });
    }
  }

  private initializeSubs() {
    this.subs.push(this.bookForm.valueChanges.subscribe(() => {
      this.bookChanged = true;
    }));

    ['serie', 'title', 'originalTitle', 'genre'].forEach(key => {
      this.subs.push(this.bookForm.controls[key].valueChanges.subscribe(val => {
        if (!val) return;
        const newVal = val.replace(/\n/g, '');
        if (val !== newVal) this.bookForm.controls[key].setValue(newVal, { emitEvent: false });
      }));
    });
  }

  protected onInput(fc: string, value: string) {
    this.bookForm.controls[fc].setValue(value);
  }

  protected async updateBook() {
    Object.keys(this.bookForm.controls).forEach(key => {
      if (key !== 'progress') this.book[key] = this.bookForm.get(key).value;
    });
    if (!this.book.img) {
      await this.fs.downloadUnknownImg();
      this.book.img = '/ebook-library/unknown.jpg';
    }
    if (this.book.img[0] === '/' && this.listsOfValues?.img?.includes(this.book.img)) {
      const path = this.getPath();
      await Filesystem.copy({
        directory: this.dir.dir,
        toDirectory: this.dir.dir,
        from: this.book.img,
        to: path
      });
      this.book.img = path;
    }
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

  private getPath(): string {
    const path = this.book.path.substring(0, this.book.path.lastIndexOf('/'));
    const suffix = this.book.img.substring(this.book.img.lastIndexOf('.') + 1);
    return `${path}/${this.book.title}.${suffix}`.replace(/[,:\s/]/g, '_');
  }

  protected editable() {
    Object.entries(this.bookForm.controls).forEach(ent => {
      const key = ent[0];
      ent[1].setValue(this.book[key] as never);
    });
    this.ready2editing = !this.ready2editing;
    Object.entries(this.bookForm.controls).forEach(ent => {
      this.ready2editing ? ent[1].enable({ emitEvent: false }) : ent[1].disable({ emitEvent: false });
    });
    this.bookChanged = false;
  }

  protected async deleteBook() {
    const dialogRef = this.dialog.open(
      DialogComponent,
      {
        data: {
          message: 'Do you really want to delete this book?',
          selects: ['Ok', 'Cancel']
        }
      }
    );
    dialogRef.afterClosed().pipe(first()).subscribe(async (selected) => {
      if (selected === 0) {
        const bookId = this.book.id;
        const authorId = this.book.creatorId;
        try {
          await this.onRemovePic(this.book.img);
          await this.removeBookFile();
        } catch (e) {
          // nothing
        }
        this.db.deleteBook(bookId).then(() => {
          this.router.navigate(['/author', authorId]);
        });
      }
    });

  }

  protected async onRemovePic(img: string) {
    if (img?.startsWith('/')) {
      await this.fs.removeFile(img).finally(() => {
        this.bookForm.get('img').setValue(null);
        this.bookChanged = true;
      }).catch(e => {
        console.error(e);
        this.dialog.open(
          DialogComponent,
          {
            data: {
              header: 'Warning',
              message: 'Deleting of pic file failed!',
              selects: ['Ok']
            }
          }
        );
      });
    } else {
      this.bookForm.get('img').setValue(null);
      this.bookChanged = true;
    }
  }

  private async removeBookFile() {
    const path2File = this.book.path.replace(/.*ebook-library/, '/ebook-library/');
    let deletable: boolean;
    try {
      deletable = !await this.db.isBookFileUsedInDifferentBook(path2File, this.book.id);
    } catch (e) {
      console.error(e);
    }
    if (deletable) {
      try {
        await this.fs.removeFile(path2File)
      } catch (e) {
        this.dialog.open(
          DialogComponent,
          {
            data: {
              header: 'Warning',
              message: 'Deleting of book file failed!',
              selects: ['Ok']
            }
          }
        );
      }
    }
  }

  protected getAuthorsBooks() {
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

  protected getBookData(index: any) {
    let jsonBook = this.jsonServ.getBook(index);
    if (jsonBook) {
      jsonBook[`length`] = jsonBook.pages;
      this.fillData(jsonBook);
    } else {
      this.workingServ.busy();
      this.jsonServ.jsonBooksData().then(() => {
        this.workingServ.done();
        jsonBook = this.jsonServ.getBook(index);
        jsonBook[`length`] = jsonBook.pages;
        this.fillData(jsonBook);
      });
    }
  }

  protected fillData(jsonBook) {
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

  protected downloadPicture() {
    const uri = this.bookForm.get('img').value;
    const path = this.book.path.substring(0, this.book.path.lastIndexOf('/') + 1);
    const index = this.bookForm.get('img').value.lastIndexOf('.');
    const extension = this.bookForm.get('img').value.substring(index);
    const filename = this.book.title + extension;

    this.workingServ.busy();
    this.fs.downloadPicture(uri, path, filename).then((src) => {
      this.workingServ.done();
      this.bookForm.get('img').setValue(src?.replace(/^.*ebook-library/, '/ebook-library'));
      this.bookChanged = true;
    }).catch((e) => {
      alert(e);
    });
  }

  protected async onGetBooksList() {
    const author = await this.db.getAuthor(this.book.creatorId);
    const dialogRef = this.dialog.open(DialogComponent, {
      data: {
        message: 'Choose a source.',
        selects: [
          'CZ databaze knih',
          'CZ legie',
          'CZ cbdb'
        ]
      }
    });
    dialogRef.afterClosed().pipe(first()).subscribe((selected) => {
      if (selected === 0) {
        this.getBooksList(author);
      } else if (selected === 1) {
        this.getBooksListLegie(author);
      } else if (selected === 2) {
        this.getBooksListCBDB(author);
      }
    });
  }

  private async getBooksList(author: AUTHOR) {
    const authorsName = [author.name || '', author.surname || ''].join(' ').trim();

    if (authorsName.length) {
      this.workingServ.busy();
      const data = await this.webScrapper.getBooksListOfAnyAuthor(this.bookForm.get('title').value);
      if (author.dtbkId) {
        const authorsBooks = await this.webScrapper.getBooksListOfAuthorById(author.dtbkId);
        this.onlineAllBooksList = authorsBooks;
        this.onlineBookList = data.filter(bk => authorsBooks.some(abk => abk.link === bk.link));
      } else {
        this.onlineBookList = data.filter(dt => dt.comment.includes(author.surname));
        if (!this.onlineBookList.length && !author.pseudonym) {
          this.onlineBookList = await this.webScrapper.getBooksListOfAuthor(authorsName);
        }
        if (!this.onlineBookList.length) {
          this.onlineBookList = data;
        }
      }
      this.workingServ.done();
      setTimeout(() => {
        this.target?.nativeElement.scrollIntoView();
      });
    }
  }

  private async getBooksListLegie(author: AUTHOR) {
    const authorsName = [author.name || '', author.surname || ''].join(' ').trim();
    const data = await this.webScrapper.getBookByNameLegie(authorsName, this.bookForm.get('title').value);
    if (!data) return;
    if (Array.isArray(data)) {
      if (!data.length && author.lgId) {
        this.onlineBookListLegie = await this.webScrapper.getBooksOfAuthorLegie(author.lgId);
        this.onlineShortStoriesListLegie = await this.webScrapper.getShortStoriesOfAuthorLegie(author.lgId);
      } else {
        this.onlineBookList = data;
      }
      this.target?.nativeElement.scrollIntoView();
    } else {
      [
        'img', 'title', 'originalTitle', 'genre',
        'publisher', 'published', 'annotation', 'language',
        'translator', 'ISBN', 'length', 'serie', 'serieOrder'
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
  }

  private async getBooksListCBDB(author: AUTHOR) {
    this.workingServ.busy();
    const data = await this.webScrapper.getCBDBBooks(this.book.title);
    console.log(data)
    if (data.list) this.onlineBookListCBDB = data.list;
    else {
      [
        'serie', 'serieOrder', 'genre', 'ISBN', 'length',
        'img', 'originalTitle', 'annotation',
        'publisher', 'published', 'cbdbId'
      ].forEach(key => {
        if (data.book[key]) {
          this.bookForm.get(key).setValue(data.book[key]);
          if (!this.listsOfValues[key].includes(data.book[key]))
            this.listsOfValues[key].push(data.book[key]);
        } else {
          this.bookForm.get(key).setValue(null);
        }
      });
      this.bookChanged = true;
      this.content.scrollToTop();
    }
    if (author.cbdbId) {
      this.onlineBookListOfAuthorCBDB = await this.webScrapper.getCBDBBooksOfAuthor(author.cbdbId);
    }
    this.workingServ.done();
  }

  protected async downloadBookInfo(item: ONLINEBOOKLINK | {
    title: string,
    link: string,
    review: string,
    lgId: string,
    dtbkId?: string,
  }) {
    if (item.dtbkId) {
      this.workingServ.busy();

      this.getBook2(item.link).then((data) => {
        if (data) {
          const noise = '...celý text';
          data.annotation = data.annotation?.endsWith(noise) ?
            data.annotation.slice(0, -noise.length) :
            data.annotation;
          data.language = data.language && data.language !== 'český' ?
            null :
            'cs-CZ';
          data.genre = data.genre?.toString();
          this.bookForm.get('dtbkId').setValue(item.lgId);
          [
            'img', 'title', 'originalTitle', 'genre',
            'publisher', 'published', 'annotation', 'language',
            'translator', 'ISBN', 'length', 'serie', 'serieOrder', 'dtbkId'
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
      }).finally(() => this.workingServ.done());
    } else if (item.lgId) {
      this.bookForm.get('lgId').setValue(item.lgId);
      const data = await this.webScrapper.getBookLegie(item.link);
      [
        'img', 'title', 'originalTitle', 'genre',
        'publisher', 'published', 'annotation', 'language',
        'translator', 'ISBN', 'length', 'serie', 'serieOrder'
      ].forEach(key => {
        if (data[key]) {
          this.bookForm.get(key).setValue(data[key]);
          if (!this.listsOfValues[key].includes(data[key]))
            this.listsOfValues[key].push(data[key]);
        }
      });
      this.bookChanged = true;
      this.content.scrollToTop();
      this.workingServ.done();
    }
  }

  protected async downloadShortStoryInfo(item) {
    this.workingServ.busy();
    try {
      const shortStory = await this.webScrapper.getShortStoryLegie(item.link);
      Object.keys(shortStory).forEach(key => {
        this.bookForm.get(key)?.setValue(shortStory[key]);
      });
    } catch (e) {
      console.error(e);
    }
    this.bookChanged = true;
    this.content.scrollToTop();
    this.workingServ.done();
  }

  protected async downloadBookInfoCBDB(link: string) {
    const data = await this.webScrapper.getCBDBBookDetails(link);
    [
      'serie', 'serieOrder', 'genre', 'ISBN', 'length',
      'img', 'originalTitle', 'annotation',
      'publisher', 'published', 'cbdbId'
    ].forEach(key => {
      if (data[key]) {
        this.bookForm.get(key).setValue(data[key]);
        if (!this.listsOfValues[key].includes(data[key]))
          this.listsOfValues[key].push(data[key]);
      } else {
        this.bookForm.get(key).setValue(null);
      }
    });
    this.bookChanged = true;
    this.content.scrollToTop();
  }

  protected async getBook2(url: string): Promise<{
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
    serie: string;
    serieOrder: number;
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
        if (e.data.serieOrder) {
          e.data.serieOrder = +e.data.serieOrder;
        }

        resolve(e.data as any);
        browser.close();
      });

      browser.on('loadstop').subscribe(() => {
        browser.executeScript({
          code: "function a(el, i) {\
            if (el) {\
              if (i == 'click') {\
                el.click();\
              } else{\
                return el[i];\
              }\
            } else {\
              return null;\
            }\
          }\
          a(document.querySelector('#abinfo > a'),'click');\
          setTimeout(() => {\
            var o={\
              annotation:a(document.querySelector('.justify.new2.odtop_big'),'textContent'),\
              genre:a(document.querySelector('[itemprop=genre]'),'innerText'),\
              img:a(document.querySelector('.kniha_img'),'src'),\
              language:a(document.querySelector('[itemprop=language]'),'innerText'),\
              originalTitle:a(document.querySelector('#bdetail_rest>div.detail_description>h4'),'innerText'),\
              length:a(document.querySelector('[itemprop=numberOfPages]'),'innerText'),\
              published:a(document.querySelector('[itemprop=datePublished]'),'textContent'),\
              publisher:a(document.querySelector('[itemprop=publisher]'),'innerText'),\
              title:a(document.querySelector('[itemprop=name]'),'innerText'),\
              translator:a(document.querySelector('[itemprop=translator]'),'innerText'),\
              ISBN:a(document.querySelector('[itemprop=isbn]'),'innerText'),\
              serie:a(document.querySelector('.detail_description h3 a'),'textContent'),\
              serieOrder:a(document.querySelector('.detail_description h3 em'),'textContent')\
            };\
            webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(o)\
          )},1000)"
        }).catch(e => {
          browser.close();
          reject(e);
        });
      });
    });
  }

  protected getMetadataFromEpub() {
    this.epub.getMetadataFromEpub(this.book.path).then((metadata) => {
      if (metadata) {
        metadata.annotation = metadata.annotation?.replace(/<[^>]*>/g, '') || null;
        ['annotation', 'ISBN', 'title', 'published', 'publisher', 'genre'].forEach(key => {
          if (metadata[key]) {
            if (this.bookForm.get(key).value !== metadata[key]) {
              this.bookForm.get(key).setValue(metadata[key]);
              this.bookChanged = true;
            }
            if (!this.listsOfValues[key].includes(metadata[key]))
              this.listsOfValues[key].push(metadata[key]);
          }

        });

        if (!metadata.imgPaths?.length) return;
        this.bookForm.controls.img.setValue(metadata.imgPaths[0]);
        this.listsOfValues.img = metadata.imgPaths;
      }
    });
  }

  protected onSwitchPic() {
    if (!this.listsOfValues.img.length) return;
    if (this.listsOfValues.img.length === 1 && this.bookForm.get('img').value) return;
    if (this.listsOfValues.img.includes(this.bookForm.get('img').value)) {
      let index = this.listsOfValues.img.indexOf(this.bookForm.get('img').value);
      index = (index + 1) % this.listsOfValues.img.length;
      this.bookForm.get('img').setValue(this.listsOfValues.img[index]);
    } else {
      this.bookForm.get('img').setValue(this.listsOfValues.img[0]);
    }
  }

  protected onReduceHeight() {
    if (this.bookForm.get('annotation').disabled)
      this._textAreaReduced = !this._textAreaReduced;
  }

  protected onGetWidth(fcName: string, title: string) {
    return {
      width: ((String(this.bookForm.get(fcName).value).length * 7) + 7) + 'px',
      'min-width': ((title.length * 9.5)) + 'px'
    };
  }

  protected onGetImgSrc(img: string) {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  protected onSkipKey(ev: Event) {
    ev.stopPropagation();
    console.log(ev)
  }

  protected onGo2(dir: 'spritz' | 'speech') {
    this.router.navigate(['/tts', this.book.id, { type: dir }]);
  }

  ngOnDestroy() {
    this.bookServ.onlineData = null;
    if (this.onlineAllBooksList || this.onlineBookListLegie || this.onlineShortStoriesListLegie) {
      this.bookServ.onlineData = {};
      this.bookServ.onlineData[this.book.creatorId] = {
        onlineAllBooksList: this.onlineAllBooksList,
        onlineBookListLegie: this.onlineBookListLegie,
        onlineShortStoriesListLegie: this.onlineShortStoriesListLegie,
      };
    }
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.workingServ.done();
  }

}
