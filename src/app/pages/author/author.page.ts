import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { HTTP } from '@ionic-native/http/ngx';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { JsonDataParserService } from 'src/app/services/json-data-parser.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { AUTHOR, WIKIPEDIADATA, BOOKSIMPLIFIED, ONLINEAUTHORLINK } from 'src/app/services/interfaces.service';

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
  imArray = [];
  listOfPictures: string[];
  authorId: number;
  jsonOfAuthorsIndex;
  fullHeight = false;
  onlineAuthorsList: ONLINEAUTHORLINK[];
  showAble = false;

  isWorking = false;

  myControl = new FormControl();
  filteredOptions: Observable<any[]>;

  subs1: Subscription;
  subs2: Subscription;

  @ViewChild(IonContent) content: IonContent;
  @ViewChild('target1') target1: ElementRef;
  @ViewChild('target2') target2: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private db: DatabaseService,
    private fs: FileReaderService,
    private http: HTTP,
    private dialog: Dialogs,
    private router: Router,
    private jsonServ: JsonDataParserService,
    private webScraper: WebScraperService
  ) { }

  ngOnInit() {
    this.myControl.disable();
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value))
    );

    this.route.paramMap.subscribe((params) => {
      const autId = params.get('id');
      const id = parseInt(autId, 10);
      this.authorId = id;

      this.subs1 = this.db.getDatabaseState().subscribe((ready) => {
        if (ready) {
          this.db
            .getAuthor(id)
            .then((data) => {
              this.author = data;
              this.fs.addBooksOfAuthor(id, data.path);

              this.db
                .getBooksOfAuthor(id)
                .then((_) => {
                  this.subs2 = this.db.getBooks().subscribe((books) => {
                    this.books = books;
                  });
                })
                .catch((e) => {
                  console.log('getBooksOfAuthor failed: ');
                  console.log(e);
                });
            })
            .catch((e) => {
              console.log('getAuthor failed: ');
              console.log(e);
            });
        }
      });
      this.jsonServ
        .jsonAuthorsIndexesData()
        .then((_) => {
          this.jsonOfAuthorsIndex = this.jsonServ.getListOfAuthors();
        })
        .catch((e) => {
          console.log('jsonServ failed');
          console.log(e);
        });
    });
    this.showAble = this.webScraper.showable;
  }

  getPosts(index: string) {
    this.isWorking = true;
    this.jsonServ.jsonAuthorsData().then((_) => {
      const jsonAuthor = this.jsonServ.getAuthor(index);

      if (jsonAuthor) {
        this.author.img = jsonAuthor.img;
        this.author.name = jsonAuthor.name;
        this.author.surname = jsonAuthor.surname;
        this.author.nationality = jsonAuthor.nationality;
        this.author.birth = jsonAuthor.birth;
        this.author.death = jsonAuthor.death;
        this.author.biography = jsonAuthor.biography;
        this.author.idInJson = index;

        this.authorChanged = true;
        this.isWorking = false;
      }
    });
  }

  _filter(value: string): string[] {
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

  updateAuthor() {
    this.db
      .updateAuthor(this.author)
      .then((_) => {
        this.wikiOutputBoolean = false;
        this.authorChanged = false;
        this.ready2editing = false;
        this.fromWiki = null;
      })
      .catch((e) => {
        console.log('updateAuthor failed: ');
        console.log(e);
      });
  }

  async editable() {
    if (this.ready2editing) {
      this.wikiOutputBoolean = false;
      this.myControl.disable();
    } else {
      this.myControl.enable();
    }
    this.db.getAuthor(this.authorId).then((author) => {
      this.author = author;
    });
    this.ready2editing = !this.ready2editing;
    this.authorChanged = false;
    this.fromWiki = null;
  }

  getFromWikipedia() {
    const searchValue = this.author.name + ' ' + this.author.surname;
    this.isWorking = true;

    this.http
      .get(
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
      )
      .then((output) => {
        this.ready2editing = true;
        this.wikiOutputBoolean = true;
        this.fromWiki = JSON.parse(output.data).query.search;
        this.isWorking = false;
        this.scrollElement(this.target1);
      })
      .catch((e) => {
        this.ready2editing = false;
        console.log(e);
      });
  }

  log(aa: WIKIPEDIADATA) {
    const pageid = aa.pageid + '';
    this.isWorking = true;
    this.http
      .get(
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
      )
      .then((output) => {
        try {
          const data = JSON.parse(output.data);
          this.author.biography = data.query.pages[pageid].extract.replace(/<[^>]*>/g, '').trim();
          this.wikiOutputBoolean = false;
          this.authorChanged = true;
          const array = Array.from(data.query.pages[pageid].images, (im) => im['title']).filter(
            (img) => !img.includes('.svg')
          );

          this.imArray = Array.from(
            array,
            (item) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + item + '?width=200'
          );

          if (data.query.pages[pageid].thumbnail) {
            this.author.img = data.query.pages[pageid].thumbnail.source;
          }
          this.parseInfobox(data.query.pages[pageid].revisions[0].slots.main['*']);
        } catch (er) {
          this.content.scrollToTop();
          this.isWorking = false;
          console.log(er);
          console.log('cannot parse data from wikipedia');
        }
      });
  }

  unhtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  changePicture() {
    if (!this.imArray.length) {
      return;
    }
    if (this.imArray.includes(this.author.img)) {
      let index = this.imArray.indexOf(this.author.img);
      index = (index + 1) % this.imArray.length;
      this.author.img = this.imArray[index];
    } else {
      this.author.img = this.imArray[0];
    }
  }

  deleteAuthor() {
    this.dialog
      .confirm('Do you really want to delete this author?\n(Files won\'t be deleted.)', null, [
        'Ok',
        'Cancel',
      ])
      .then((res) => {
        if (res === 1) {
          this.db.deleteAuthor(this.author.id).then((_) => {
            this.router.navigate(['/authors']);
          });
        }
      });
  }

  parseInfobox(data: string) {
    const infobox = data.split('\n\n')[0];
    const array = infobox.split('\n');
    const obj = {
      name: null,
      birth_date: null,
      death_date: null,
      nationality: null,
    };
    for (const item of array) {
      if (item.indexOf('= ') !== -1) {
        const neco = item.split('= ');
        const key = neco[0].substring(1).trim();
        let value: string | number = neco[1].trim();
        if (obj[key] === null) {
          if (key === 'birth_date' || key === 'death_date') {
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
    if (obj.nationality) {
      this.author.nationality = obj.nationality.replace(/{{[^}]*}}/g, '').trim();
    }
    this.author.birth = obj.birth_date;
    this.author.death = obj.death_date;
    if (obj.name) {
      if (obj.name.indexOf(' ') !== -1) {
        this.author.name = obj.name.substring(0, obj.name.lastIndexOf(' '));
        this.author.surname = obj.name.substring(obj.name.lastIndexOf(' ') + 1);
      } else {
        this.author.surname = obj.name;
      }
    }
    this.isWorking = false;
    this.content.scrollToTop();
  }

  downloadPicture() {
    const uri = this.author.img;
    const path = this.author.path;
    const index = this.author.img.lastIndexOf('.');
    const extension = this.author.img.substring(index);

    const filename = this.author.name + '_' + this.author.surname + extension;

    this.isWorking = true;
    this.fs
      .downloadPicture(uri, path, filename)
      .then((src) => {
        this.isWorking = false;
        this.author.img = src;
        this.content.scrollToTop();
      })
      .catch((e) => {
        this.isWorking = false;
        this.content.scrollToTop();
        console.log(e);
        alert(JSON.stringify(e));
      });
  }

  getAuthor() {
    let authorsName: string;
    if (!this.author.name || this.author.name.length < 3) {
      authorsName = this.author.surname;
    } else {
      authorsName = this.author.name + ' ' + this.author.surname;
    }
    this.isWorking = true;
    this.webScraper.getAuthorsList(authorsName).then((data) => {
      this.onlineAuthorsList = data;
      this.isWorking = false;
      this.scrollElement(this.target2);
    });
  }

  downloadAuthorInfo(url: string) {
    this.isWorking = true;
    this.webScraper.getAuthor(url).then((data) => {
      if (data) {
        this.author.name = this.author.name || data.name;
        this.author.surname = this.author.surname || data.surname;
        this.author.nationality = this.author.nationality || data.nationality;
        this.author.biography = this.author.biography || data.biography;
        this.author.birth = this.author.birth || data.birth;
        this.author.death = this.author.death || data.death;
        this.author.img = this.author.img || data.img;

        this.authorChanged = true;
        this.isWorking = false;
        this.content.scrollToTop();
      }
    });
  }

  private scrollElement(target: ElementRef) {
    this.content.scrollToPoint(0, target.nativeElement.offsetTop, 500);
  }

  ngOnDestroy() {
    if (this.subs1) {
      this.subs1.unsubscribe();
    }
    if (this.subs2) {
      this.subs2.unsubscribe();
    }
  }
}
