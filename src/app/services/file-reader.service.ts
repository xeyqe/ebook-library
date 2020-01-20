import { Injectable } from '@angular/core';
import { File } from '@ionic-native/file/ngx';
import { DatabaseService, Book } from './database.service';

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
            console.log('copyFile failed: ');
            console.log(e);
          });
      }).catch(e => {
        console.log(e.message);
        if (e.message === 'NOT_FOUND_ERR') {
          this.file.createDir(path + ebl, ow, false).then(() => {
              this.createApplicationFolder();
          }).catch(er => {
            console.log('createDir failed: ');
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
      console.log('checkDir in dirExists failed: ');
      console.log(e);
    });
  }

  createDir(path: string, name: string): Promise<boolean> {
    return this.file.createDir(path, name, false).then(_ => {
      return true;
    }).catch(e => {
      console.log('createDir failed: ');
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
        console.log('copyDorian failed: ');
        console.log(e);
        return false;
      });
  }


  listOfAuthors() {
    this.db.loadAuthors();
    const path = this.file.externalRootDirectory;
    this.db.allAuthorsPaths().then(data => {

      this.file.checkDir(path, 'ebook-library').then(_ => {
        this.file.listDir(path, 'ebook-library').then(output => {
          for (const authorFolder of output) {
            if (authorFolder.isDirectory) {
              if (!data.includes(authorFolder.fullPath)) {
                const name = authorFolder.name.split(',');
                const surname = name[0].trim();
                let firstName = '';
                if (name[1]) {
                  firstName = name[1].trim();
                }

                const pth = authorFolder.fullPath;
                this.db.addAuthor({id: null, name: firstName, surname, nationality: null, birth: null,
                  death: null, biography: null, img: null, rating: null, path: pth}).then(() => {
                    console.log('author added');
                    console.log({firstName, surname, pth});
                  });
              }
            }
          }
        }).catch(e => {
          console.log('listDir in listOfAuthors failed');
          console.log(e);
        });
      }).catch(e => {
        console.log('checkDir in listOfAuthors failed: ');
        console.log(e);
      });
    }).catch(data => {
      console.log('data');
      console.log(data);
    });
  }

  addBooksOfAuthor(authorId: number, path: string) {
    this.db.authorsBooksPaths(authorId).then(paths => {
      this._booksOfAuthor(path, authorId, paths);
    });
   }

   _booksOfAuthor(folderPath: string, authorId: number, paths: string[]) {
    let folder = folderPath.substring(1, folderPath.length - 1);
    const path = this.file.externalRootDirectory + folder.substring(0, folder.lastIndexOf('/') + 1);

    folder = folder.substring(folder.lastIndexOf('/') + 1);

    this.file.listDir(path, folder).then(output => {
      for (const item of output) {
        if (item.isFile) {
          const bookPath = item.fullPath;
          if (!paths.includes(bookPath)) {
            let book: Book;
            const id = authorId;
            const name = item.name.substring(0, item.name.lastIndexOf('.'));
            book = {id: null,
                    title: name,
                    creatorId: id,
                    originalTitle: null,
                    annotation: null,
                    publisher: null,
                    published: null,
                    genre: null,
                    length: null,
                    language: 'cs-CZ',
                    translator: null,
                    ISBN: null,
                    path: bookPath,
                    progress: null,
                    rating: null
            };
            this.db.addBook(book);
          }
        } else if (item.isDirectory) {
          this._booksOfAuthor(item.fullPath, authorId, paths);
        }
      }
    }).catch(e => {
      console.log('listDir failed: ');
      console.log(e);
    });
   }

   _getPathAndFilename(fullPath: string) {
    const path = fullPath.substring(0, fullPath.lastIndexOf('/') + 1);
    const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1);
    return [path, fileName];
   }

   readTextFile(fullPath: string): Promise<string> {
     const array = this._getPathAndFilename(fullPath);
     const path = array[0];
     const fileName = array[1];
     return this.file.readAsText(this.file.externalRootDirectory + path, fileName);
   }

}
