import { Injectable, OnInit } from '@angular/core';

import { File } from '@ionic-native/file/ngx';
import { Downloader, DownloadRequest, NotificationVisibility } from '@ionic-native/downloader/ngx';
import { WebView } from '@ionic-native/ionic-webview/ngx';

import { DatabaseService, Book } from 'src/app/services/database.service';

@Injectable({
  providedIn: 'root',
})
export class FileReaderService implements OnInit {
  ready2addBooks = true;
  ready2addAuthors = true;

  constructor(
    private file: File,
    private db: DatabaseService,
    private downloader: Downloader,
    private webView: WebView
  ) {}

  ngOnInit() {}

  createApplicationFolder() {
    const path = this.file.externalRootDirectory;
    const ebl = 'ebook-library';
    const ow = 'Wilde, Oscar';

    this.file
      .checkDir(path, ebl)
      .then(() => {
        this.file
          .checkDir(path + ebl + '/', ow)
          .then(() => {
            this.file
              .copyFile(
                this.file.applicationDirectory + 'www/assets/',
                'Obraz Doriana Graye.txt',
                path + ebl + '/' + ow,
                'Obraz Doriana Graye.txt'
              )
              .then(() => {
                this.listOfAuthors();
              })
              .catch((e) => {
                console.log('copyFile failed: ');
                console.log(e);
              });
          })
          .catch((e) => {
            console.log(e.message);
            if (e.message === 'NOT_FOUND_ERR') {
              this.file
                .createDir(path + ebl, ow, false)
                .then(() => {
                  this.createApplicationFolder();
                })
                .catch((er) => {
                  console.log('createDir failed: ');
                  console.log(er);
                });
            }
          });
      })
      .catch((e) => {
        console.log(e.message);
        if (e.message === 'NOT_FOUND_ERR') {
          this.file
            .createDir(path, ebl, false)
            .then(() => {
              this.createApplicationFolder();
            })
            .catch((er) => {
              console.log('cannot create library folder');
              console.log(er);
            });
        }
      });
  }

  dirExists(path: string, name: string) {
    return this.file.checkDir(path, name).catch((e) => {
      console.log('checkDir in dirExists failed: ');
      console.log(e);
    });
  }

  createDir(path: string, name: string): Promise<boolean> {
    return this.file
      .createDir(path, name, false)
      .then((_) => {
        return true;
      })
      .catch((e) => {
        console.log('createDir failed: ');
        console.log(e);
        return false;
      });
  }

  copyDorian(path: string): Promise<boolean> {
    return this.file
      .copyFile(
        this.file.applicationDirectory + 'www/assets/',
        'Obraz Doriana Graye.txt',
        path + 'ebook-library/Wilde, Oscar',
        'Obraz Doriana Graye.txt'
      )
      .then((_) => {
        return true;
      })
      .catch((e) => {
        console.log('copyDorian failed: ');
        console.log(e);
        return false;
      });
  }

  listOfAuthors() {
    const path = this.file.externalRootDirectory;
    this.db.loadAuthors().then(() => {
      this.db
        .loadAllBooks()
        .then(() => {
          if (this.ready2addAuthors) {
            this.ready2addAuthors = false;
            this.db
              .allAuthorsPaths()
              .then((data) => {
                this.file
                  .checkDir(path, 'ebook-library')
                  .then(() => {
                    this.file
                      .listDir(path, 'ebook-library')
                      .then((output) => {
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
                              this.db
                                .addAuthor({
                                  id: null,
                                  name: firstName,
                                  surname,
                                  nationality: null,
                                  birth: null,
                                  death: null,
                                  biography: null,
                                  img: null,
                                  rating: null,
                                  path: pth,
                                  idInJson: null,
                                })
                                .then((authorID) => {
                                  this.db.authorsBooksPaths(authorID).then((paths) => {
                                    this._booksOfAuthor(pth, authorID, paths);
                                  });
                                });
                            }
                          }
                        }
                        this.ready2addAuthors = true;
                      })
                      .catch((e) => {
                        this.ready2addAuthors = true;
                        console.log('listDir in listOfAuthors failed');
                        console.log(e);
                      });
                  })
                  .catch((e) => {
                    this.ready2addAuthors = true;
                    console.log('checkDir in listOfAuthors failed: ');
                    console.log(e);
                  });
              })
              .catch((data) => {
                this.ready2addAuthors = true;
                console.log('data');
                console.log(data);
              });
          }
        })
        .catch((err) => {
          console.log('loadAllBooks failed:');
          console.log(err);
        });
    });
  }

  addBooksOfAuthor(authorId: number, path: string) {
    if (this.ready2addBooks) {
      this.ready2addBooks = false;
      this.db.authorsBooksPaths(authorId).then((paths) => {
        this._booksOfAuthor(path, authorId, paths);
      });
    }
  }

  _booksOfAuthor(folderPath: string, authorId: number, paths: string[]) {
    let folder = folderPath.substring(1, folderPath.length - 1);
    const path = this.file.externalRootDirectory + folder.substring(0, folder.lastIndexOf('/') + 1);

    folder = folder.substring(folder.lastIndexOf('/') + 1);

    this.file
      .listDir(path, folder)
      .then((output) => {
        for (const item of output) {
          if (item.isFile) {
            const regex = RegExp('.+.txt');
            if (regex.test(item.name)) {
              const bookPath = item.fullPath;
              if (!paths.includes(bookPath)) {
                let book: Book;
                const id = authorId;
                const name = item.name.substring(0, item.name.lastIndexOf('.'));
                book = {
                  id: null,
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
                  rating: null,
                  img: null,
                };
                this.db.addBook(book);
              }
            }
          } else if (item.isDirectory) {
            this._booksOfAuthor(item.fullPath, authorId, paths);
          }
        }
        this.ready2addBooks = true;
      })
      .catch((e) => {
        this.ready2addBooks = true;
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

  downloadPicture(Uri: string, path: string, fileName: string): Promise<string> {
    const request: DownloadRequest = {
      uri: Uri,
      title: 'MyDownload',
      description: '',
      mimeType: '',
      visibleInDownloadsUi: true,
      notificationVisibility: NotificationVisibility.VisibleNotifyCompleted,
      destinationInExternalPublicDir: {
        dirType: path,
        subPath: fileName,
      },
    };
    console.log(path + fileName);

    if (path[0] === '/') {
      path = path.substring(1);
    }
    const externalPath = this.file.externalRootDirectory;
    let a: string;
    a = this.webView.convertFileSrc(externalPath + path + fileName);

    return new Promise((resolve) => {
      this.file
        .checkFile(externalPath + path, fileName)
        .then((_) => {
          resolve(a);
        })
        .catch((e) => {
          console.log(e);
          this.downloader
            .download(request)
            .then((location) => {
              resolve(a);
            })
            .catch((er) => {
              console.log(er);
            });
        });
    });
  }
}
