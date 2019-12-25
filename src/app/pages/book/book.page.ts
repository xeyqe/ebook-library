import { Component, OnInit } from '@angular/core';
import { DatabaseService, Book } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-book',
  templateUrl: './book.page.html',
  styleUrls: ['./book.page.scss'],
})
export class BookPage implements OnInit {
  book: Book = null;
  bookChanged = false;
  fileName: string;

  dontworryiwillnameyoulater: string;
  dontworryiwillnameyoulater2: string;



  constructor(private route: ActivatedRoute,
              private db: DatabaseService,
              private fs: FileReaderService) { }

    ngOnInit() {
      this.route.paramMap.subscribe(params => {
        const autId = params.get('id');
        const id = parseInt(autId, 10);
        this.db.getDatabaseState().subscribe(ready => {
          if (ready) {

            this.db.getBook(id).then(data => {
              this.fileName = data.title;

              this.book = data;
              this.dontworryiwillnameyoulater = this.book.id + '0';
              this.dontworryiwillnameyoulater2 = this.book.id + '1';
            }).catch(e => {
              console.log('getBook failed: ');
              console.log(e);
            });
          }
        });
      });
    }

    updateBook() {
      this.db.updateBook(this.book).then(() => {
        this.bookChanged = false;
        this.fs.renameFile(this.book.path, this.fileName + '.txt', this.book.title + '.txt').then(() => {
          this.fileName = this.book.title;
        }).catch(e => {
          console.log(e);
        });
      }).catch(e => {
        console.log('updateBook failed: ');
        console.log(e);
      });
    }

}
