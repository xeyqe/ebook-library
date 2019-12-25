import { Injectable } from '@angular/core';
import { File } from '@ionic-native/file/ngx';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class FileReaderService {

  constructor(private file: File, private db: DatabaseService) {}

  createApplicationFolder() {
    const path = this.file.externalRootDirectory;
    const ebl = 'ebook-library';
    const ow = 'Wilde, Oscar';

    this.file.checkDir(path, ebl).then(() => {
      this.file.checkDir(path + ebl + '/', ow).then(() => {
        this.file.copyFile(this.file.applicationDirectory + 'www/assets/',
          'Obraz Doriana Graye.txt',
          path + ebl + '/' + ow,
          'Obraz Doriana Graye.txt').then(() => {
            this.listOfAuthors();
          }).catch(e => {
            console.log(e);
          });
      }).catch(e => {
        console.log(e.message);
        if (e.message === 'NOT_FOUND_ERR') {
          this.file.createDir(path + ebl, ow, false).then(() => {
              this.createApplicationFolder();
          }).catch(er => {
            console.log(er);
          });
        }

      });
    }).catch(e => {
      console.log(e.message);
      if (e.message === 'NOT_FOUND_ERR') {
        this.file.createDir(path, ebl, false).then(() => {
          this.createApplicationFolder();
        }).catch(er => {
          console.log('cannot create library folder');
          console.log(er);
        });
      }
    });

  }

  dirExists(path: string, name: string) {
    return this.file.checkDir(path, name).catch(e => {
      console.log(e);
    });
  }

  createDir(path: string, name: string): Promise<boolean> {
    return this.file.createDir(path, name, false).then(_ => {
      return true;
    }).catch(e => {
      console.log(e);
      return false;
    });
  }

  copyDorian(path: string): Promise<boolean> {
    return this.file.copyFile(this.file.applicationDirectory + 'www/assets/',
      'Obraz Doriana Graye.txt',
      path + 'ebook-library/Wilde, Oscar',
      'Obraz Doriana Graye.txt').then(_ => {
        return true;
      }).catch(e => {
        console.log(e);
        return false;
      });
  }


  listOfAuthors() {
    const path = this.file.externalRootDirectory;

    this.file.checkDir(path, 'ebook-library').then(_ => {
      this.file.listDir(path, 'ebook-library').then(output => {
        for (const authorFolder of output) {
          if (authorFolder.isDirectory) {
            const name = authorFolder.name.split(',');
            const surname = name[0].trim();
            let firstName = '';
            if (name[1]) {
              firstName = name[1].trim();
            }

            this.db.checkIfAuthorExists(firstName, surname).then(
              exists => {
                if (!exists) {
                  this.db.addAuthor({id: null, name: firstName, surname, nationality: null,
                                     birth: null, death: null, biography: null, img: null, rating: null}).then(id => {
                    this.addBooksOfAuthor(authorFolder.name, id);
                  }).catch(e => {
                    console.log('addAuthor failed: ');
                    console.log(e);
                  });
                }
              }).catch(e => {
                console.log('checkIfAuthorExists failed: ');
                console.log(e);
              });
          }
        }
        this.db.loadAuthors();
      }).catch(e => {
        console.log('listOfAuthors\'s listDir failed: ');
        console.log(e);
      });
    }).catch(e => {
      console.log('listofauthors failed:');
      console.log(e);
    });
   }

   addBooksOfAuthor(authorName: string, id: number, subDirPath: string = 'ebook-library/') {
    console.log('addBooksOfAuthor');
    console.log(subDirPath);
    const path = this.file.externalRootDirectory + subDirPath;

    this.file.listDir(path, authorName).then(output => {
      for (const book of output) {
        if (book.isFile) {
          let path2book = book.fullPath; // it's only relative path
          path2book = path2book.substring(1, path2book.lastIndexOf('/') + 1);
          const bookName = book.name.substring(0, book.name.lastIndexOf('.'));

          this.db.addBookIfNotExists(bookName, id, path2book);
        } else if (book.isDirectory) {
          console.log('isDirectory');
          console.log('book.name: ' + book.name);
          console.log(book.fullPath.substring(0, book.fullPath.lastIndexOf('/') + 1));
          let sbp = book.fullPath;
          sbp = sbp.substring(0, sbp.length - 1);
          sbp = sbp.substring(0, sbp.lastIndexOf('/') + 1);
          this.addBooksOfAuthor(book.name, id, sbp);
        }
      }
    }).catch(e => {
      console.log('addBooksOfAuthor\'s listDir failed: ');
      console.log(e);
    });
   }

   readTextFile(path: string, title: string): Promise<string> {
    return this.file.readAsText(this.file.externalRootDirectory + path, title + '.txt');
   }

   renameFile(path: string, fileName: string, newFileName: string): Promise<any> {
     const fullPath = this.file.externalRootDirectory + path;
     return this.file.moveFile(fullPath, fileName, fullPath, newFileName);
   }
}
