import { Component, OnInit } from '@angular/core';
import { DatabaseService, Author, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HTTP } from '@ionic-native/http/ngx';
import { Dialogs } from '@ionic-native/dialogs/ngx';
import { FormGroup, FormControl } from '@angular/forms';


@Component({
  selector: 'app-author',
  templateUrl: './author.page.html',
  styleUrls: ['./author.page.scss'],
})
export class AuthorPage implements OnInit {
  authorForm = new FormGroup({
    authorImg: new FormControl(''),
    authorName: new FormControl(''),
    authorSurname: new FormControl(''),
    authorNationality: new FormControl(''),
    authorBirth: new FormControl(''),
    authorDeath: new FormControl(''),
    authorBiography: new FormControl('')
  });

  author: Author = null;
  books: Book[] = [];
  biography = '';
  textareaFocus = false;
  authorChanged = false;
  ready2editing = false;
  fromWiki;
  wikiOutputBoolean = false;
  listOfPictures;
  imArray = [];
  authorId: number;

  constructor(private route: ActivatedRoute,
              private db: DatabaseService,
              private fs: FileReaderService,
              private http: HTTP,
              private dialog: Dialogs,
              private router: Router) {
               }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const autId = params.get('id');
      const id = parseInt(autId, 10);
      this.authorId = id;

      this.db.getDatabaseState().subscribe(ready => {
        if (ready) {
          this.db.getAuthor(id).then(data => {
            this.author = data;

            this.db.getBooksOfAuthor(id).then(_ => {
              this.db.getBooks().subscribe(books => {
                this.books = books;
                this.fs.addBooksOfAuthor(id, data.path);
              });
            }).catch(e => {
              console.log('getBooksOfAuthor failed: ');
              console.log(e);
            });
          }).catch(e => {
            console.log('getAuthor failed: ');
            console.log(e);
          });
        }
      });
    });
  }

  updateAuthor() {
    this.db.updateAuthor(this.author).then(_ => {
      this.authorChanged = false;
      this.ready2editing = false;
      this.fromWiki = null;
    }).catch(e => {
      console.log('updateAuthor failed: ');
      console.log(e);
    });
  }

  editable() {
    if (this.ready2editing) {
      this.wikiOutputBoolean = false;
    }
    this.db.getAuthor(this.authorId).then(author => {
      this.author = author;
    });
    this.ready2editing = !this.ready2editing;
    this.authorChanged = false;
    this.fromWiki = null;
  }

  getFromWikipedia() {
    const searchValue = this.author.name + ' ' + this.author.surname;

    this.http.get('https://wikipedia.org/w/api.php',
    { action: 'query', list: 'search', srsearch: searchValue, rvprop: 'content', rvsection: '0',
     rvslots: '*', format: 'json'}, {}).then(output => {
      this.ready2editing = true;
      this.wikiOutputBoolean = true;

      this.fromWiki = JSON.parse(output.data).query.search;
    }).catch(e => {
      this.ready2editing = false;
      console.log(e);
    });

  }

  log(aa: any) {
    const pageid = aa.pageid + '';
    this.http.get('https://wikipedia.org/w/api.php',
    { action: 'query', prop: 'revisions|extracts|images|pageimages', format: 'json', rvprop: 'content', rvsection: '0', rvslots: '*',
     pageids: pageid, exintro: 'explaintext', imlimit: '130', piprop: 'thumbnail', pithumbsize: '300'}, {}).then(output => {
      try {
        const data = JSON.parse(output.data);
        this.author.biography = data.query.pages[pageid].extract.replace(/<[^>]*>/g, '').trim();
        this.wikiOutputBoolean = false;
        this.authorChanged = true;
        const array = Array.from(data.query.pages[pageid].images, im => im['title'])
                         .filter(img => !img.includes('.svg'));
        this.imArray = Array.from(array, item => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + item + '?width=200');
        this.imArray.push(null);
        if (data.query.pages[pageid].thumbnail) {
          this.author.img = data.query.pages[pageid].thumbnail.source;
        }
        this.parseInfobox(data.query.pages[pageid].revisions[0].slots.main['*']);
      } catch (er) {
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
    this.dialog.confirm('Do you really want to delete this author?\n(Files won\'t be deleted.)', null, ['Ok', 'Cancel']).then(res => {
      if (res === 1) {
        this.db.deleteAuthor(this.author.id).then(_ => {
          this.router.navigate(['/authors']);
        });
      }
    });
  }

  parseInfobox(data: any) {
    const infobox = data.split('\n\n')[0];
    const array = infobox.split('\n');
    const obj = {name: null, birth_date: null, death_date: null, nationality: null};
    for (let item of array) {
      if (item.indexOf('= ') !== -1) {
        const neco = item.split('= ');
        const key = neco[0].substring(1).trim();
        let value = neco[1].trim();
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

  }

}
