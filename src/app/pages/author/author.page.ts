import { Component, OnInit } from '@angular/core';
import { DatabaseService, Author, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { ActivatedRoute } from '@angular/router';
import { HTTP } from '@ionic-native/http/ngx';

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

  constructor(private route: ActivatedRoute,
              private db: DatabaseService,
              private fs: FileReaderService,
              private http: HTTP) {
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
    { action: 'query', prop: 'extracts|pageimages', format: 'json',
     pageids: pageid, exintro: 'explaintext', piprop: 'thumbnail', pithumbsize: '300', pilimit: '10'}, {}).then(output => {
      try {
        const data = JSON.parse(output.data);
        this.author.biography = data.query.pages[pageid].extract.replace(/<[^>]*>/g, '').trim();
        this.author.img = data.query.pages[pageid].thumbnail.source;
        this.wikiOutputBoolean = false;
        this.authorChanged = true;
        console.log(data);
      } catch {
        console.log('cannot parse data from wikipedia');
      }
    });
  }

  unhtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

}
