import { Component, OnInit, ViewChild, ElementRef, OnDestroy, Renderer2 } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';

import { AllFilesAccess } from 'capacitor-all-files-access-permission';

import { MatDialog } from '@angular/material/dialog';

import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { FilePicker } from '@capawesome/capacitor-file-picker';

import { Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

import { NonusedPicsService } from './nonused-pics.service';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { AUTHOR, WIKIPEDIADATA, ONLINEAUTHORLINK, AUTHORSBOOKS } from 'src/app/services/interfaces';

import { PictureComponent } from '../picture/picture.component';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';


@Component({
  selector: 'app-author',
  templateUrl: './author.page.html',
  styleUrls: ['./author.page.scss'],
  animations: [
    trigger('collapse', [
      state('true', style({ height: AUTO_STYLE, visibility: AUTO_STYLE })),
      state('false', style({ height: '0', visibility: 'hidden' })),
      transition('false => true', animate(500 + 'ms ease-in')),
      transition('true => false', animate(500 + 'ms ease-out'))
    ])
  ],
  standalone: false,
})
export class AuthorComponent implements OnInit, OnDestroy {
  @ViewChild('pictureC') pictureC: PictureComponent | undefined;
  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target1') target1: ElementRef;
  @ViewChild('target2') target2: ElementRef;
  @ViewChild('contEl') contEl: ElementRef;

  protected author: AUTHOR = null;
  protected books: AUTHORSBOOKS[] = [];
  protected biography = '';
  protected textareaFocus = false;
  protected authorChanged = false;
  protected ready2editing = false;
  protected fromWiki: WIKIPEDIADATA[];
  protected wikiOutputBoolean = false;
  protected listOfPictures: string[];
  protected authorId: number;
  protected fullHeight = false;
  protected onlineAuthorsList: ONLINEAUTHORLINK[];
  protected onlineAuthorsListLegie: ONLINEAUTHORLINK[];
  protected onlineAuthorsListCBDB: {
    link: string;
    img: string;
    name: string;
    date: string;
    cbdbId: string;
  }[];
  protected showAble = false;
  protected focusedOn: string;

  protected authorForm: FormGroup<{
    img: FormControl<string>,
    name: FormControl<string>,
    surname: FormControl<string>,
    pseudonym: FormControl<string>,
    nationality: FormControl<string>,
    birth: FormControl<number>,
    death: FormControl<number>,
    biography: FormControl<string>,
    idInJson: FormControl<string>,
    dtbkId: FormControl<string>,
    lgId: FormControl<string>,
    cbdbId: FormControl<string>,
  }>;
  protected listsOfValues: {
    img: string[],
    name: string[],
    surname: string[],
    pseudonym: string[],
    nationality: string[],
    birth: number[],
    death: number[],
    biography: string[],
  };
  protected _textAreaReduced = true;
  protected imgPreLink: string;
  protected seriesCont: { name: string, open: boolean, books: AUTHORSBOOKS[] }[];

  private subs: Subscription[] = [];
  private readonly imgSuffix = Math.floor(Math.random() * 1000000);

  constructor(
    private db: DatabaseService,
    private dialog: MatDialog,
    private directoryServ: DirectoryService,
    private fs: FileReaderService,
    private picsServ: NonusedPicsService,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private router: Router,
    private webScraper: WebScraperService,
    private workingServ: BusyService,
  ) { }

  ngOnInit() {
    this.initialize();
    this.showAble = this.webScraper.showAble;
  }

  ionViewDidEnter() {
    this.db.getBooksOfAuthor(this.author.booksIds).then(books => {
      console.log(books)
      if (!books?.length) return;
      this.updateOldBooksImgs(books);
      this.takeCareOfSeries(books);
      this.loadUnusedPics([...books.map(bk => bk.img), this.author.img]);
      this.setMinWidths();
    });
  }

  private async initialize() {
    this.authorId = await this.getAuthorId();
    await this.isDBReady();
    this.author = await this.db.getAuthor(this.authorId);
    console.log(this.author)
    this.imgPreLink = this.directoryServ.imgPreLink;
    this.updateOldImgs(this.author.img);
    this.initializeForm(this.author);
    this.fs.addBooksOfAuthor(this.author.id, this.author.path);
  }

  private getAuthorId(): Promise<number> {
    return new Promise((resolve) => {
      this.route.paramMap.subscribe({
        next: (params) => {
          resolve(+params.get('id'))
        }
      });
    });
  }

  private isDBReady(): Promise<boolean> {
    return new Promise((resolve) => {
      this.subs.push(this.db.getDatabaseState().subscribe({
        next: (ready) => {
          resolve(ready);
        },
        error: (error) => {
          resolve(false);
          console.error(error);
        }
      }));
    });
  }

  private async updateOldImgs(img: string) {
    if (!img) return;
    if (img.startsWith('http://localhost/_app_file_/storage') || img.startsWith('http://localhost/_capacitor_file_/')) {
      this.author.img = img?.replace(/.*\/ebook-library/, '/ebook-library') || null;
      await this.db.updateAuthor(this.author);
    }
  }

  private updateOldBooksImgs(books: AUTHORSBOOKS[]) {
    for (const book of books) {
      if (book.img?.startsWith('http://localhost/_app_file_/storage') || book.img?.startsWith('http://localhost/_capacitor_file_/')) {
        book.img = book.img?.replace(/.*\/ebook-library/, '/ebook-library') || null;
      }
    }
  }

  private initializeForm(author: AUTHOR) {
    this.listsOfValues = {} as any;
    this.authorForm = new FormGroup({
      img: new FormControl({ value: null, disabled: true }),
      name: new FormControl({ value: null, disabled: true }),
      surname: new FormControl({ value: null, disabled: true }),
      pseudonym: new FormControl({ value: null, disabled: true }),
      nationality: new FormControl({ value: null, disabled: true }),
      birth: new FormControl({ value: null, disabled: true }),
      death: new FormControl({ value: null, disabled: true }),
      biography: new FormControl({ value: null, disabled: true }),
      idInJson: new FormControl(),
      dtbkId: new FormControl(),
      lgId: new FormControl(),
      cbdbId: new FormControl(),
    });
    Object.entries(this.authorForm.controls).forEach(ent => {
      const key = ent[0];
      const fc = ent[1];
      fc.setValue((author[key] || null) as never);
      this.listsOfValues[key] = author[key] ? [author[key]] : [];
    });

    this.subs.push(this.authorForm.valueChanges.subscribe(() => {
      this.authorChanged = true;
    }));
  }

  private takeCareOfSeries(books: AUTHORSBOOKS[]) {
    const seriesNames = [];
    const oldSeries = this.seriesCont ? [...this.seriesCont] : [];
    this.seriesCont = [];

    const serieLessBooks: AUTHORSBOOKS[] = [];
    books.forEach(book => {
      if (!book.serie) {
        serieLessBooks.push(book);
        return;
      }
      if (!seriesNames.includes(book.serie)) {
        seriesNames.push(book.serie);
        const open = oldSeries.find(itm => itm.name === book.serie)?.open || false;
        this.seriesCont.push({ name: book.serie, open, books: [book] });
      } else {
        const item = this.seriesCont.find(itm => itm.name === book.serie);
        item.books.push(book);
      }
    });
    this.seriesCont.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });


    this.books = serieLessBooks;
    if (!seriesNames?.length) return;
    this.db.getSeriesBooks(seriesNames, this.author.id).then(otherBooks => {
      Object.keys(otherBooks).forEach(key => {
        const serie = this.seriesCont.find(it => it.name === key);
        serie.books.push(...otherBooks[key]);
      });
      this.seriesCont.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    });
  }

  private async loadUnusedPics(usedPics: string[]): Promise<void> {
    const allFiles = await this.fs.getNonBookFilesOfFolder(this.author.path);
    const unUsed = allFiles.filter(fl => !usedPics.includes(fl));
    const images = new Set([...this.listsOfValues.img, ...unUsed])
    this.listsOfValues.img = [...images];
    this.picsServ.pics = unUsed.length ? unUsed : null;
  }

  private setMinWidths() {
    setTimeout(() => {
      const ar = Array.from(document.querySelectorAll('mat-form-field'));
      ar.forEach(el => {
        const width = el?.querySelector('mat-label')?.getBoundingClientRect()?.width;
        if (!width) return;
        this.renderer.setStyle(el, 'minWidth', Math.ceil(width + 16) + 'px');
      });
    });
  }

  // protected async onGetPosts(index: string) {
  //   this.workingServ.busy();
  //   await this.jsonServ.jsonAuthorsData();
  //   const jsonAuthor = this.jsonServ.getAuthor(index);

  //   if (jsonAuthor) {
  //     Object.entries(this.authorForm.controls).forEach(ent => {
  //       const key = ent[0];
  //       const fc = ent[1];
  //       fc.setValue((jsonAuthor[key] || null) as never);
  //       if (jsonAuthor[key] && !this.listsOfValues[key].includes(jsonAuthor[key]))
  //         this.listsOfValues[key].push(jsonAuthor[key]);
  //     });
  //     this.authorForm.controls.idInJson.setValue(index);
  //     this.workingServ.done();
  //   }
  // }

  // private _filter(value: string): string[] {
  //   if (!value || value.length < 4) {
  //     return null;
  //   }

  //   if (this.jsonOfAuthorsIndex && value && value.length) {
  //     const filterValue = value.toLowerCase();
  //     return this.jsonOfAuthorsIndex.filter((option) =>
  //       option.name.toLowerCase().includes(filterValue)
  //     );
  //   } else {
  //     return undefined;
  //   }
  // }

  protected displayFn(subject) {
    if (subject && !subject.name) {
      return subject;
    } else if (subject && subject.name) {
      const index = subject.name.lastIndexOf(' ');
      if (index === -1) {
        return subject;
      } else {
        return subject.name.substring(subject.name.lastIndexOf(' ') + 1);
      }
    } else {
      return undefined;
    }
  }

  protected async onUpdateAuthor() {
    let img = this.pictureC.getCurrentImg();
    if (img?.startsWith('/ebook-library/epub/')) {
      const nm = [this.authorForm.controls.name.value || '', this.authorForm.controls.surname.value || ''].join('_');
      const path = await this.fs.getUniquePath(this.author.path + nm + img.slice(img.lastIndexOf('.')));
      await Filesystem.copy({
        directory: this.directoryServ.dir,
        toDirectory: this.directoryServ.dir,
        from: img,
        to: path
      });
      img = path;
    }
    if (this.authorForm.controls.img.value !== img)
      this.authorForm.controls.img.setValue(img);
    Object.keys(this.authorForm.controls).forEach(key => {
      this.author[key] = this.authorForm.controls[key].value;
      try {
        this.authorForm.controls[key].disable();
      } catch (e) {
        console.error(key);
        console.error(e);
      }
    });
    this.db.updateAuthor(this.author).then(() => {
      this.wikiOutputBoolean = false;
      this.authorChanged = false;
      this.ready2editing = false;
      this.fromWiki = null;
    }).catch((e) => {
      console.log(this.author);
      console.error('updateAuthor failed: ');
      console.error(e);
    });
  }

  protected async onEditable() {
    this.ready2editing = !this.ready2editing;
    if (!this.ready2editing) {
      this.wikiOutputBoolean = false;
    }
    Object.entries(this.authorForm.controls).forEach(ent => {
      const key = ent[0];
      const fc = ent[1];
      if (this.ready2editing)
        fc.enable();
      else {
        fc.setValue((this.author[key] || null) as never);
        fc.disable();
      }
    });
    this.authorChanged = false;
    this.fromWiki = null;
    this.setMinWidths();
  }

  // protected getFromWikipedia() {
  //   const searchValue = this.authorForm.controls.name.value + ' ' + this.authorForm.controls.surname.value;
  //   this.workingServ.busy();

  //   this.http.get(
  //     'https://wikipedia.org/w/api.php',
  //     {
  //       action: 'query',
  //       list: 'search',
  //       srsearch: 'intitle:' + searchValue,
  //       rvprop: 'content',
  //       rvsection: '0',
  //       rvslots: '*',
  //       format: 'json',
  //     },
  //     {}
  //   ).then((output) => {
  //     this.ready2editing = true;
  //     this.wikiOutputBoolean = true;
  //     this.fromWiki = JSON.parse(output.data).query.search;
  //     this.workingServ.done();
  //     this.scrollElement(this.target1);
  //   }).catch((e) => {
  //     this.ready2editing = false;
  //     console.error(e);
  //   });
  // }

  // protected onSetWikipediaData(aa: WIKIPEDIADATA) {
  //   const pageid = aa.pageid + '';
  //   this.workingServ.busy();
  //   this.http.get(
  //     'https://wikipedia.org/w/api.php',
  //     {
  //       action: 'query',
  //       prop: 'revisions|extracts|images|pageimages',
  //       format: 'json',
  //       rvprop: 'content',
  //       rvsection: '0',
  //       rvslots: '*',
  //       pageids: pageid,
  //       exintro: 'explaintext',
  //       imlimit: '130',
  //       piprop: 'thumbnail',
  //       pithumbsize: '300',
  //     },
  //     {}
  //   ).then((output) => {
  //     try {
  //       const data = JSON.parse(output.data);
  //       const obj = { biography: null, img: null };
  //       obj.biography = data.query.pages[pageid].extract.replace(/<[^>]*>/g, '').trim();
  //       this.wikiOutputBoolean = false;
  //       this.authorChanged = true;
  //       const array = Array.from(data.query.pages[pageid].images, (im) => im['title']).filter(
  //         (img) => !img.includes('.svg')
  //       );

  //       Array.from(
  //         array,
  //         (item) => `https://commons.wikimedia.org/wiki/Special:FilePath/${item}?width=200`
  //       ).forEach(img => {
  //         if (!this.listsOfValues.img.includes(img))
  //           this.listsOfValues.img.push(img);
  //       });

  //       if (data.query.pages[pageid].thumbnail) {
  //         obj.img = data.query.pages[pageid].thumbnail.source;
  //       }
  //       ['biography', 'img'].forEach(key => {
  //         this.authorForm.get(key).setValue(obj[key] || null);
  //         if (obj[key] && !this.listsOfValues[key].includes(obj[key]))
  //           this.listsOfValues[key].push(obj[key]);
  //       });
  //       this.parseInfobox(data.query.pages[pageid].revisions[0].slots.main['*']);
  //     } catch (er) {
  //       this.content.scrollToTop();
  //       this.workingServ.done();
  //       console.error(er);
  //       console.error('cannot parse data from wikipedia');
  //     }
  //   });
  // }

  protected onUnhtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  protected onChangePicture() {
    if (!this.listsOfValues.img.length) return;
    if (this.listsOfValues.img.length === 1 && this.authorForm.controls.img.value) return;
    if (this.listsOfValues.img.includes(this.authorForm.controls.img.value)) {
      let index = this.listsOfValues.img.indexOf(this.authorForm.controls.img.value);
      index = (index + 1) % this.listsOfValues.img.length;
      this.authorForm.controls.img.setValue(this.listsOfValues.img[index]);
    } else {
      this.authorForm.controls.img.setValue(this.listsOfValues.img[0]);
    }
  }

  protected async deleteAuthor() {
    const dialogRef = this.dialog.open(
      DialogComponent,
      {
        data: {
          message: 'Do you really want to delete this author?\n(Files won\'t be deleted.)',
          selects: ['Ok', 'Cancel']
        }
      }
    );
    dialogRef.afterClosed().pipe(first()).subscribe((selected) => {
      if (selected === 0) {
        this.db.deleteAuthor(this.author.id).then(() => {
          this.router.navigate(['/authors']);
        });
      }
    });
  }

  private parseInfobox(data: string) {
    const infobox = data.split('\n\n')[0];
    const array = infobox.split('\n');
    const obj = {
      name: null,
      surname: null,
      birth: null,
      death: null,
      nationality: null,
    };
    for (const item of array) {
      if (item.indexOf('= ') !== -1) {
        const neco = item.split('= ');
        const key = neco[0].substring(1).trim();
        let value: string | number = neco[1].trim();
        if (obj[key] === null) {
          if (['birth', 'death'].includes(key)) {
            const myRe = new RegExp(/\|[0-9]+\|/, 'g');
            const date = myRe.exec(value);
            if (date) {
              value = parseInt(date[0].substring(1, date[0].length - 1), 10);
            }
          }
          obj[key] = value;
        }
      }
    }
    obj.nationality = obj.nationality?.replace(/{{[^}]*}}/g, '')?.trim();
    if (obj.name) {
      if (obj.name.indexOf(' ') !== -1) {
        obj.name = obj.name.substring(0, obj.name.lastIndexOf(' '));
        obj.surname = obj.name.substring(obj.name.lastIndexOf(' ') + 1);
      } else {
        obj.surname = obj.name;
      }
    }

    ['name', 'surname', 'birth', 'death', 'nationality'].forEach(key => {
      this.authorForm.get(key).setValue(obj[key] || null);
      if (obj[key] && !this.listsOfValues[key].includes(obj[key]))
        this.listsOfValues[key].push(obj[key]);
    });

    this.workingServ.done();
    this.content.scrollToTop();
  }

  protected onDownloadPicture() {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    let uri = this.authorForm.controls.img.value;
    if (uri.lastIndexOf('.') < uri.lastIndexOf('?')) {
      uri = uri.substring(0, uri.lastIndexOf('?'));
    }
    const path = this.author.path;
    const index = uri.lastIndexOf('.');
    const extension = uri.substring(index);

    const filename = this.authorForm.controls.name.value + '_' + this.authorForm.controls.surname.value + extension;

    this.workingServ.busy();
    this.fs.downloadPicture(uri, path, filename).then((src) => {
      this.workingServ.done();
      const img = src?.replace(/^.*ebook-library/, '/ebook-library');
      this.authorForm.controls.img.setValue(img);
      this.pictureC.deleteCurrentImg(img);
      this.content.scrollToTop();
    }).catch((e) => {
      this.workingServ.done();
      this.content.scrollToTop();
      console.error(e);
      alert(JSON.stringify(e));
    });
  }

  protected onGetAuthor() {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    let authorsName: string;
    if (!this.authorForm.controls.name.value || this.authorForm.controls.name.value.length < 3) {
      authorsName = this.authorForm.controls.surname.value;
    } else {
      authorsName = this.authorForm.controls.name.value + ' ' + this.authorForm.controls.surname.value;
    }
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
        this.dtbkGetAuthorList(authorsName);
      } else if (selected === 1) {
        this.legieGetAuthorList(authorsName);
      } else if (selected === 2) {
        this.cbdbGetAuthorList(authorsName);
      }
    });
  }

  private dtbkGetAuthorList(authorName: string) {
    this.workingServ.busy();
    this.webScraper.getAuthorsList(authorName).then((data) => {
      this.onlineAuthorsList = data;
      this.workingServ.done();
      this.scrollElement(this.target2);
    }).finally(() => this.workingServ.done());
  }

  private legieGetAuthorList(authorName: string) {
    this.workingServ.busy();
    this.webScraper.getAuthorsListLegie(authorName).then((data) => {
      if (data) {
        if (Array.isArray(data)) {
          this.onlineAuthorsListLegie = data;
          this.scrollElement(this.target2);
        } else {
          ['img', 'name', 'surname', 'birth', 'death', 'nationality', 'biography', 'lgId'].forEach(key => {
            this.authorForm.get(key).setValue(data[key] || null);
            if (data[key] && !this.listsOfValues[key].includes(data[key]))
              this.listsOfValues[key].push(data[key]);
          });
        }
        this.workingServ.done();
      }
    }).finally(() => this.workingServ.done());
  }

  private cbdbGetAuthorList(author: string) {
    this.workingServ.busy();
    this.webScraper.getAuthorsListCBDB(author).then(data => {
      if (data) {
        this.onlineAuthorsListCBDB = data;
        this.scrollElement(this.target2);
      }
    }).finally(() => {
      this.workingServ.done();
    });
  }

  protected onDownloadAuthorInfo(item: ONLINEAUTHORLINK) {
    this.workingServ.busy();
    if (item.dtbkId) {
      this.webScraper.getAuthor(item.link).then((data) => {
        if (data) {
          Object.entries(this.authorForm.controls).forEach(ent => {
            const key = ent[0];
            const fc = ent[1];
            if (key !== 'lgId') fc.setValue((data[key] || null) as never);
            if (data[key] && !this.listsOfValues[key].includes(data[key]))
              this.listsOfValues[key].push(data[key]);
          });
        }
      }).finally(() => {
        this.workingServ.done();
        this.content.scrollToTop();
      });
    } else if (item.lgId) {
      this.webScraper.getLegieAuthor(item.link).then((data) => {
        if (data) {
          Object.entries(this.authorForm.controls).forEach(ent => {
            const key = ent[0];
            const fc = ent[1];
            const value = data[key] || null;
            fc.setValue(value as never); // TODO ???
            if (data[key] && !this.listsOfValues[key].includes(data[key]))
              this.listsOfValues[key].push(data[key]);
          });
        }
      }).finally(() => {
        this.workingServ.done();
        this.content.scrollToTop();
      });
    }
  }

  protected onDownloadAuthorInfoCBDB(cbdbId: string) {
    this.workingServ.busy();
    this.webScraper.getAuthorCBDB(cbdbId).then(author => {
      console.log(author)
      if (author) {
        Object.entries(this.authorForm.controls).forEach(ent => {
          const key = ent[0];
          const fc = ent[1];
          const value = author[key] || null;
          fc.setValue(value as never); // TODO ???
          if (author[key] && !this.listsOfValues[key].includes(author[key]))
            this.listsOfValues[key].push(author[key]);
        });
      }
    }).finally(() => {
      this.content.scrollToTop();
      this.workingServ.done();
    });
  }

  private scrollElement(target: ElementRef) {
    if (!target) return;
    this.content.scrollToPoint(0, target.nativeElement.offsetTop, 500);
  }

  protected onRemovePic() {
    const img = this.pictureC.getCurrentImg() || this.authorForm.controls.img.value;
    if (img.startsWith('/')) {
      this.fs.removeFile(img).finally(() => {
        this.authorForm.controls.img.setValue(null);
        this.pictureC.deleteCurrentImg();
        this.authorChanged = true;
      }).catch(() => {
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
      this.authorForm.controls.img.setValue(null);
      this.authorChanged = true;
    }
  }

  protected onReduceHeight() {
    if (this.authorForm.controls.biography.disabled)
      this._textAreaReduced = !this._textAreaReduced;
  }

  protected onAddPicture() {
    const name = this.authorForm.controls.name.value || '';
    const surname = this.authorForm.controls.surname.value || '';
    this.pictureC.addPicture([name, surname].join(' '));
  }

  protected onDownloadBuVisible(path: string): boolean {
    return path && !path.startsWith('/');
  }

  protected onGetImgSrc(img: string) {
    if (!img) img = '/ebook-library/unknown.jpg';
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) + `?ver=${this.imgSuffix}` : img;
  }

  protected onPicChanged(img: string) {
    this.authorChanged = true;
    this.authorForm.controls.img.setValue(img);
  }

  protected onAddBook() {
    FilePicker.pickFiles({
      types: ['application/epub+zip', 'text/plain', 'application/pdf'],
      // multiple: true
    }).then(async a => {
      for (const file of a.files) {
        const title = file.name.substring(0, file.name.lastIndexOf('.'));
        const path = await this.fs.getUniquePath(this.author.path + file.name);
        // const nm = path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
        // let from = await this.filePath.resolveNativePath(file.path);
        // console.log(encodeURI(file.path))

        // const ar = [
        //   { key: Directory.ExternalStorage, uri: (await Filesystem.getUri({ directory: Directory.ExternalStorage, path: '' })).uri },
        //   { key: Directory.External, uri: (await Filesystem.getUri({ directory: Directory.External, path: '' })).uri },
        //   { key: Directory.Cache, uri: (await Filesystem.getUri({ directory: Directory.Cache, path: '' })).uri },
        //   { key: Directory.Data, uri: (await Filesystem.getUri({ directory: Directory.Data, path: '' })).uri },
        //   { key: Directory.Documents, uri: (await Filesystem.getUri({ directory: Directory.Documents, path: '' })).uri },
        //   { key: Directory.Library, uri: (await Filesystem.getUri({ directory: Directory.Library, path: '' })).uri },
        // ].sort((a, b) => b.uri.length - a.uri.length);

        // let directory: Directory;
        // ar.forEach(it => {
        //   if (from.startsWith(it.uri)) {
        //     directory = it.key;
        //     from = from.substring(it.uri.length, from.lastIndexOf('/') + 1) + name;
        //     return;
        //   }
        // });
        const destUri = (await Filesystem.getUri({
          directory: this.directoryServ.dir,
          path
        })).uri;

        await AllFilesAccess.copyFile({ sourceUri: file.path, destinationUri: destUri });

        // await Filesystem.copy({
        //   from: file.path,
        //   to: path,
        //   // directory,
        //   toDirectory: this.directoryServ.dir
        // });
        const bookId = await this.db.addBook({
          id: null, title: title, creatorIds: [this.author.id], originalTitle: null, annotation: null,
          publisher: null, published: null, genre: null, length: null, language: 'cs-CZ', translator: null,
          ISBN: null, path, progress: null, rating: null, img: null, serie: null, serieOrder: null,
          dtbkId: null, lgId: null, cbdbId: null, added: new Date(), lastRead: null, finished: null
        });
        this.books.push({
          id: bookId + '',
          title: title,
          creatorIds: [this.author.id],
          progress: null,
          img: null,
          serie: null,
          serieOrder: null,
        });
      }

    });
  }

  protected onFocus(fcNm: string) {
    setTimeout(() => this.focusedOn = fcNm, 1);
  }

  protected onBlur() {
    setTimeout(() => this.focusedOn = null);
  }

  protected onInput(fc: string, value: string | number) {
    this.authorForm.controls[fc].setValue(value);
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
    this.workingServ.done();
  }
}
