import { Component, OnInit } from '@angular/core';
import { DatabaseService, Author, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { ActivatedRoute } from '@angular/router';

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

  constructor(private route: ActivatedRoute,
              private db: DatabaseService,
              private fs: FileReaderService) {
               }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const autId = params.get('id');
      const id = parseInt(autId, 10);

      this.db.getDatabaseState().subscribe(ready => {
        if (ready) {
          console.log('database ready');
          this.db.getAuthor(id).then(data => {
            this.author = data;
            this.oldAuthor = data;

            this.db.getBooksOfAuthor(id).then(_ => {
              this.db.getBooks().subscribe(books => {
                console.log(books);
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
    }
    this.ready2editing = !this.ready2editing;
    this.authorChanged = false;
  }

}
