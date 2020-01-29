import { Component, OnInit } from '@angular/core';
import { DatabaseService, Author, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HTTP } from '@ionic-native/http/ngx';
import { Dialogs } from '@ionic-native/dialogs/ngx';


@Component({
  selector: 'app-author',
  templateUrl: './author.page.html',
  styleUrls: ['./author.page.scss'],
})
export class AuthorPage implements OnInit {

  author: Author = null;
  oldAuthor: Author = null;
  books: Book[] = [];
  biography = '';
  textareaFocus = false;
  authorChanged = false;
  ready2editing = false;
  fromWiki;
  wikiOutputBoolean = false;
  listOfPictures;
  imArray = [];

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

      this.db.getDatabaseState().subscribe(ready => {
        if (ready) {
          this.db.getAuthor(id).then(data => {
            this.author = data;
            this.oldAuthor = data;

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
      this.oldAuthor = { ...this.author};
      this.fromWiki = null;
    }).catch(e => {
      console.log('updateAuthor failed: ');
      console.log(e);
    });
  }

  editable() {
    if (this.ready2editing) {
      this.author = { ...this.oldAuthor};
      this.wikiOutputBoolean = false;
    }
    this.ready2editing = !this.ready2editing;
    this.authorChanged = false;
    this.fromWiki = null;
  }

  getFromWikipedia() {
    const searchValue = this.author.name + ' ' + this.author.surname;

    this.http.get('https://wikipedia.org/w/api.php',
    { action: 'query', list: 'search', srsearch: searchValue, format: 'json'}, {}).then(output => {
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
    { action: 'query', prop: 'extracts|images|pageimages', format: 'json',
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
        this.author.img = data.query.pages[pageid].thumbnail.source;
      } catch {
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

}
