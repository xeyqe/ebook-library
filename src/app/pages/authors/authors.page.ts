import { DatabaseService, Author } from './../../services/database.service';
import { FileReaderService } from './../../services/file-reader.service';
import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';


@Component({
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],
})
export class AuthorsPage implements OnInit {

  authors: Author[] = [];
  author = {};
  lastListenedBookId: string;
  subscribtion;

  selectedView = 'TODO';
  filterStatus = '';
  alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
              'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q',
              'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];
  selectedCharacter = 'A';

  constructor(private db: DatabaseService,
              private fr: FileReaderService,
              private platform: Platform) {
     }

  ngOnInit() {
    console.log('authors ngOnIni');
    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        this.db.getAuthors().subscribe(authors => {
          this.authors = authors;
        });

        this.platform.ready().then(() => {
          this.fr.createApplicationFolder();
          this.fr.listOfAuthors();
        }).catch(e => {
          console.log('plt.ready failed: ');
          console.log(e);
        });
      }
    });
  }

  ionViewWillEnter() {
    this.db.getValue('as').then(data => {
      this.lastListenedBookId = data;
    });
  }

  changeSelectedChar(character: string) {
    if (character.length === 1) {
      this.selectedCharacter = character;
    }
  }

}
