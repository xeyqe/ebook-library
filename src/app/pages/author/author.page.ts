import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { HTTP } from '@ionic-native/http/ngx';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { Capacitor } from '@capacitor/core';

import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';
import { AUTHOR, WIKIPEDIADATA, BOOKSIMPLIFIED, ONLINEAUTHORLINK, BOOK } from 'src/app/services/interfaces';


@Component({
  selector: 'app-author',
  templateUrl: './author.page.html',
  styleUrls: ['./author.page.scss'],
})
export class AuthorPage implements OnInit, OnDestroy {
  author: AUTHOR = null;
  books: BOOKSIMPLIFIED[] = [];
  biography = '';
  textareaFocus = false;
  authorChanged = false;
  ready2editing = false;
  fromWiki: WIKIPEDIADATA[];
  wikiOutputBoolean = false;
  listOfPictures: string[];
  authorId: number;
  jsonOfAuthorsIndex;
  fullHeight = false;
  onlineAuthorsList: ONLINEAUTHORLINK[];
  showAble = false;

  isWorking = false;

  filteredOptions: Observable<any[]>;
  authorForm: FormGroup;
  listsOfValues: {
    img: any[],
    name: any[],
    surname: any[],
    nationality: any[],
    birth: any[],
    death: any[],
    biography: any[],
  };
  _textAreaReduced = true;
  imgPreLink: string;

  private subs: Subscription[] = [];

  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target1') target1: ElementRef;
  @ViewChild('target2') target2: ElementRef;

  constructor(
    private db: DatabaseService,
    private dialog: Dialogs,
    private directoryServ: DirectoryService,
    private fs: FileReaderService,
    private http: HTTP,
    private jsonServ: JsonDataParserService,
    private route: ActivatedRoute,
    private router: Router,
    private webScraper: WebScraperService,
  ) { }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const autId = params.get('id');
      const id = parseInt(autId, 10);
      this.authorId = id;

      this.subs.push(this.db.getDatabaseState().subscribe({
        next: (ready) => {
          if (ready) {
            this.db.getAuthor(id).then((data) => {
              this.author = data;
              this.imgPreLink = this.directoryServ.imgPreLink;
              this.updateOldImgs(data.img);
              this.initializeForm(this.author);
              this.fs.addBooksOfAuthor(id, data.path);

              this.db.getBooksOfAuthor(id).then(() => {
                this.subs.push(this.db.getBooks().subscribe((books) => {
                  this.books = books;
                  this.updateOldBooksImgs(books);
                }));
              }).catch((e) => {
                console.error('getBooksOfAuthor failed: ');
                console.error(e);
              });
            }).catch((e) => {
              console.error('getAuthor failed: ');
              console.error(e);
            });
          }
        }, error: e => {
          console.error(e)
        }
      }));
      this.jsonServ.jsonAuthorsIndexesData().then(() => {
        this.jsonOfAuthorsIndex = this.jsonServ.getListOfAuthors();
      }).catch((e) => {
        console.error('jsonServ failed');
        console.error(e);
      });
    });
    this.showAble = this.webScraper.showAble;
  }

  private async updateOldImgs(img: string) {
    if (!img) return;
    if (img.startsWith('http://localhost/_app_file_/storage')) {
      this.author.img = img?.replace(/.*\/ebook-library/, '/ebook-library') || null;
      await this.db.updateAuthor(this.author);
    }
  }

  private async updateOldBooksImgs(books: BOOK[]) {
    for (const book of books) {
      if (book.img?.startsWith('http://localhost/_app_file_/storage')) {
        book.img = book.img?.replace(/.*\/ebook-library/, '/ebook-library') || null;
        await this.db.updateBook(book);
      }
    }
  }

  private initializeForm(author: AUTHOR) {
    this.listsOfValues = {} as any;
    this.authorForm = new FormGroup({
      img: new FormControl({ value: null, disabled: true }),
      name: new FormControl({ value: null, disabled: true }),
      surname: new FormControl({ value: null, disabled: true }),
      nationality: new FormControl({ value: null, disabled: true }),
      birth: new FormControl({ value: null, disabled: true }),
      death: new FormControl({ value: null, disabled: true }),
      biography: new FormControl({ value: null, disabled: true }),
      idInJson: new FormControl()
    });
    Object.entries(this.authorForm.controls).forEach(ent => {
      const key = ent[0];
      const fc = ent[1];
      fc.setValue(author[key] || null);
      this.listsOfValues[key] = author[key] ? [author[key]] : [];
    });

    this.filteredOptions = this.authorForm.get('surname').valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value))
    );
    this.subs.push(this.authorForm.valueChanges.subscribe(() => {
      this.authorChanged = true;
    }));
  }

  async onGetPosts(index: string) {
    this.isWorking = true;
    await this.jsonServ.jsonAuthorsData();
    const jsonAuthor = this.jsonServ.getAuthor(index);

    if (jsonAuthor) {
      Object.entries(this.authorForm.controls).forEach(ent => {
        const key = ent[0];
        const fc = ent[1];
        fc.setValue(jsonAuthor[key] || null);
        if (jsonAuthor[key] && !this.listsOfValues[key].includes(jsonAuthor[key]))
          this.listsOfValues[key].push(jsonAuthor[key]);
      });
      this.authorForm.get('idInJson').setValue(index);
      this.isWorking = false;
    }
  }

  private _filter(value: string): string[] {
    if (!value || value.length < 4) {
      return null;
    }

    if (this.jsonOfAuthorsIndex && value && value.length) {
      const filterValue = value.toLowerCase();
      return this.jsonOfAuthorsIndex.filter((option) =>
        option.name.toLowerCase().includes(filterValue)
      );
    } else {
      return undefined;
    }
  }

  displayFn(subject) {
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

  onUpdateAuthor() {
    Object.entries(this.authorForm.controls).forEach(ent => {
      const key = ent[0];
      const val = ent[1].value;
      this.author[key] = val;
    });
    this.db.updateAuthor(this.author).then(() => {
      this.wikiOutputBoolean = false;
      this.authorChanged = false;
      this.ready2editing = false;
      this.fromWiki = null;
    }).catch((e) => {
      console.error('updateAuthor failed: ');
      console.error(e);
    });
  }

  async onEditable() {
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
        fc.setValue(this.author[key] || null);
        fc.disable();
      }
    });
    this.authorChanged = false;
    this.fromWiki = null;
  }

  getFromWikipedia() {
    const searchValue = this.authorForm.get('name').value + ' ' + this.authorForm.get('surname').value;
    this.isWorking = true;

    this.http.get(
      'https://wikipedia.org/w/api.php',
      {
        action: 'query',
        list: 'search',
        srsearch: 'intitle:' + searchValue,
        rvprop: 'content',
        rvsection: '0',
        rvslots: '*',
        format: 'json',
      },
      {}
    ).then((output) => {
      this.ready2editing = true;
      this.wikiOutputBoolean = true;
      this.fromWiki = JSON.parse(output.data).query.search;
      this.isWorking = false;
      this.scrollElement(this.target1);
    }).catch((e) => {
      this.ready2editing = false;
      console.error(e);
    });
  }

  onSetWikipediaData(aa: WIKIPEDIADATA) {
    const pageid = aa.pageid + '';
    this.isWorking = true;
    this.http.get(
      'https://wikipedia.org/w/api.php',
      {
        action: 'query',
        prop: 'revisions|extracts|images|pageimages',
        format: 'json',
        rvprop: 'content',
        rvsection: '0',
        rvslots: '*',
        pageids: pageid,
        exintro: 'explaintext',
        imlimit: '130',
        piprop: 'thumbnail',
        pithumbsize: '300',
      },
      {}
    ).then((output) => {
      try {
        const data = JSON.parse(output.data);
        const obj = { biography: null, img: null };
        obj.biography = data.query.pages[pageid].extract.replace(/<[^>]*>/g, '').trim();
        this.wikiOutputBoolean = false;
        this.authorChanged = true;
        const array = Array.from(data.query.pages[pageid].images, (im) => im['title']).filter(
          (img) => !img.includes('.svg')
        );

        Array.from(
          array,
          (item) => `https://commons.wikimedia.org/wiki/Special:FilePath/${item}?width=200`
        ).forEach(img => {
          if (!this.listsOfValues.img.includes(img))
            this.listsOfValues.img.push(img);
        });

        if (data.query.pages[pageid].thumbnail) {
          obj.img = data.query.pages[pageid].thumbnail.source;
        }
        ['biography', 'img'].forEach(key => {
          this.authorForm.get(key).setValue(obj[key] || null);
          if (obj[key] && !this.listsOfValues[key].includes(obj[key]))
            this.listsOfValues[key].push(obj[key]);
        });
        this.parseInfobox(data.query.pages[pageid].revisions[0].slots.main['*']);
      } catch (er) {
        this.content.scrollToTop();
        this.isWorking = false;
        console.error(er);
        console.error('cannot parse data from wikipedia');
      }
    });
  }

  onUnhtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  onChangePicture() {
    if (!this.listsOfValues.img.length) return;
    if (this.listsOfValues.img.includes(this.authorForm.get('img').value)) {
      let index = this.listsOfValues.img.indexOf(this.authorForm.get('img').value);
      index = (index + 1) % this.listsOfValues.img.length;
      this.authorForm.get('img').setValue(this.listsOfValues.img[index]);
    } else {
      this.authorForm.get('img').setValue(this.listsOfValues.img[0]);
    }
  }

  async deleteAuthor() {
    const res = await this.dialog.confirm(
      'Do you really want to delete this author?\n(Files won\'t be deleted.)',
      null,
      ['Ok', 'Cancel']
    );
    if (res === 1) {
      this.db.deleteAuthor(this.author.id).then(() => {
        this.router.navigate(['/authors']);
      });
    }
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

    this.isWorking = false;
    this.content.scrollToTop();
  }

  onDownloadPicture() {
    const uri = this.authorForm.get('img').value;
    const path = this.author.path;
    const index = this.authorForm.get('img').value.lastIndexOf('.');
    const extension = this.authorForm.get('img').value.substring(index);

    const filename = this.authorForm.get('name').value + '_' + this.authorForm.get('surname').value + extension;

    this.isWorking = true;
    this.fs.downloadPicture(uri, path, filename).then((src) => {
      this.isWorking = false;
      this.authorForm.get('img').setValue(src);
      this.content.scrollToTop();
    }).catch((e) => {
      this.isWorking = false;
      this.content.scrollToTop();
      console.error(e);
      alert(JSON.stringify(e));
    });
  }

  onGetAuthor() {
    let authorsName: string;
    if (!this.authorForm.get('name').value || this.authorForm.get('name').value.length < 3) {
      authorsName = this.authorForm.get('surname').value;
    } else {
      authorsName = this.authorForm.get('name').value + ' ' + this.authorForm.get('surname').value;
    }
    this.isWorking = true;
    this.webScraper.getAuthorsList(authorsName).then((data) => {
      this.onlineAuthorsList = data;
      this.isWorking = false;
      this.scrollElement(this.target2);
    });
  }

  onDownloadAuthorInfo(url: string) {
    this.isWorking = true;
    this.webScraper.getAuthor(url).then((data) => {
      if (data) {
        Object.entries(this.authorForm.controls).forEach(ent => {
          const key = ent[0];
          const fc = ent[1];
          fc.setValue(data[key] || null);
          if (data[key] && !this.listsOfValues[key].includes(data[key]))
            this.listsOfValues[key].push(data[key]);
        });

        this.isWorking = false;
        this.content.scrollToTop();
      }
    });
  }

  private scrollElement(target: ElementRef) {
    if (!target) return;
    this.content.scrollToPoint(0, target.nativeElement.offsetTop, 500);
  }

  onRemovePic() {
    if (this.authorForm.get('img').value.includes('_capacitor_file_')) {

      this.fs.removeFile(this.authorForm.get('img').value.split('ebook-library')[1]).then(() => {
        this.authorForm.get('img').setValue(null);
        this.authorChanged = true;
      }).catch(e => {
        this.dialog.alert('Deleting of pic file failed!', 'Warning', 'OK');
      });
    } else {
      this.authorForm.get('img').setValue(null);
      this.authorChanged = true;
    }
  }

  onReduceHeight() {
    if (this.authorForm.get('biography').disabled)
      this._textAreaReduced = !this._textAreaReduced;
  }

  onGetWidth(fcName: string, title: string) {
    return {
      width: (String(this.authorForm.get(fcName).value).length * 7 + 4) + 'px',
      'min-width': (title.length * 9.5) + 'px'
    };
  }

  onIsImgLocal(path: string): boolean {
    return path?.startsWith('/');
  }

  onGetImgSrc(img: string) {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  ngOnDestroy() {
    this.subs?.forEach(sub => sub?.unsubscribe());
  }
}
