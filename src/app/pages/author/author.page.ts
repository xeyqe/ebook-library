import { Component, OnInit } from '@angular/core';
import { DatabaseService, Author, Book } from './../../services/database.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-author',
  templateUrl: './author.page.html',
  styleUrls: ['./author.page.scss'],
})
export class AuthorPage implements OnInit {

  author: Author = null;
  books: Book[];
  biography = '';
  textareaFocus = false;
  authorChanged = false;

  constructor(private route: ActivatedRoute,
              private db: DatabaseService) { }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const autId = params.get('id');
      const id = parseInt(autId, 10);

      this.db.getDatabaseState().subscribe(ready => {
        if (ready) {
          this.db.getAuthor(id).then(data => {
            this.author = data;
          }).catch(e => {
            console.log('getAuthor failed: ');
            console.log(e);
          });

          this.db.getBooksOfAuthor(id).then(data => {
            this.books = data;
          }).catch(e => {
            console.log('getBooksOfAuthor failed: ');
            console.log(e);
          });
        }
      });
    });
  }

  updateAuthor() {
    this.db.updateAuthor(this.author).then(_ => {
      this.authorChanged = false;
    }).catch(e => {
      console.log('updateAuthor failed: ');
      console.log(e);
    });
  }

}
