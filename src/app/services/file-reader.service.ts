import { Injectable } from '@angular/core';

import { Filesystem, Encoding, FileInfo, ReaddirResult } from '@capacitor/filesystem';

import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';

import { DirectoryService } from './directory.service';
import { DatabaseService } from 'src/app/services/database.service';

import { BOOK } from 'src/app/services/interfaces';


@Injectable({
  providedIn: 'root',
})
export class FileReaderService {
  ready2addBooks = true;
  ready2addAuthors = true;

  constructor(
    private db: DatabaseService,
    private dir: DirectoryService,
    private webView: WebView,
  ) { }

  public async accessAllFilesPermissionGranted(): Promise<boolean> {
    Filesystem.checkPermissions().then(a => console.log(a)).catch(e => console.error(e));
    return Filesystem.readdir({
      directory: this.dir.dir,
      path: '/'
    }).then(a => {
      console.log(a)
      return true;
    }).catch(e => {
      console.error(e)
      return false;
    });
  }

  public async createApplicationFolder() {
    console.log('createApplicationFolder')
    return new Promise<void>((resolve) => {
      Filesystem.readdir({
        directory: this.dir.dir,
        path: ''
      }).then(async item => {
        if (item.files.some(it => it.name === 'ebook-library')) resolve();
        else {
          await Filesystem.mkdir({
            directory: this.dir.dir,
            path: 'ebook-library'
          });
          await Filesystem.mkdir({
            directory: this.dir.dir,
            path: 'ebook-library/Wilde, Oscar'
          });
          return await this.downloadDorian();
        }
      });
    });
  }

  public downloadDorian(): Promise<any> {
    return Filesystem.downloadFile({
      directory: this.dir.dir,
      path: 'ebook-library/Wilde, Oscar/The Picture of Dorian Gray.epub',
      url: 'https://www.gutenberg.org/ebooks/174.epub.noimages?session_id=931e40dbce8a034672c993b24b343cb40c0e667d'
    }).catch(e => {
      console.error('downloadDorian failed!');
      console.error(e);
    })
  }

  public async listOfAuthors() {
    console.log('listOfAuthors')
    try {
      if (this.ready2addAuthors) {
        this.ready2addAuthors = false;
        let allAuthorsPaths: string[];
        try {
          allAuthorsPaths = await this.db.allAuthorsPaths();
          console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@')
          console.log('allAuthorsPath')
          console.log(allAuthorsPaths)
        } catch (e) {
          console.error('this.db.allAuthorsPaths failed')
          console.error(e)
        }

        let foldersFiles: ReaddirResult;
        try {
          foldersFiles = await Filesystem.readdir({
            directory: this.dir.dir,
            path: 'ebook-library'
          });
          console.log(foldersFiles)
        } catch (e) {
          console.error('Filesystem.readdir failed')
          console.error(e)
        }
        const folders: FileInfo[] = [];
        for (const item of foldersFiles.files) {
          console.log(item)
          if (item.type === 'directory' && item.name !== 'epub')
            folders.push(item);
        }
        for (const authorFolder of folders) {
          console.log(`/ebook-library/${authorFolder.name}`)
          if (!allAuthorsPaths.includes(`/ebook-library/${authorFolder.name}`) && !allAuthorsPaths.includes(`/ebook-library/${authorFolder.name}/`)) {
            const name = authorFolder.name.substring(authorFolder.name.lastIndexOf('/') + 1).split(',');
            const surname = name[0].trim();
            let firstName = '';
            if (name[1]) {
              firstName = name[1].trim();
            }
            let authorId: number;

            try {
              authorId = await this.db.addAuthor({
                id: null,
                name: firstName,
                surname,
                pseudonym: null,
                nationality: null,
                birth: null,
                death: null,
                biography: null,
                img: null,
                rating: null,
                path: `/ebook-library/${authorFolder.name}`,
                idInJson: null,
                dtbkId: null,
                lgId: null,
                cbdbId: null,
              });
              console.log(`authorId: ${authorId}`);
            } catch (e) {
              console.error('authorId = await this.db.addAuthor failed')
              console.error(e)
            }
            try {
              this.db.authorsBooksPaths(authorId).then((paths) => {
                console.log('paths')
                console.log(paths)
                try {
                  this._booksOfAuthor(`/ebook-library/${authorFolder.name}/`, authorId, paths);
                } catch (e) {
                  console.error(`_booksOfAuthor`)
                  console.error(e)
                }
              });
            } catch (e) {
              console.error(e)
            }
          }
        }

        this.ready2addAuthors = true;
      }
    } catch (e) {
      console.error('listOfAuthors failed!');
      throw e;
    }
  }

  public addBooksOfAuthor(authorId: number, path: string) {
    console.log('addBooksOfAuthor')
    console.log(arguments)
    if (this.ready2addBooks) {
      this.ready2addBooks = false;
      this.db.authorsBooksPaths(authorId).then((paths) => {
        this._booksOfAuthor(path, authorId, paths);
      });
    }
  }

  public async getNonBookFilesOfFolder(path: string): Promise<string[]> {
    console.log('getNonBookFilesOfFolder')
    console.log(arguments)
    const item = await Filesystem.readdir({
      directory: this.dir.dir,
      path
    }).catch(e => {
      console.error('getNonBookFilesOfFolder readdir failed.');
      throw e;
    });
    const foundFiles = [];
    for (const file of item.files) {
      if (file.type === 'file') {
        const extension = file.name.substring(file.name.lastIndexOf('.') + 1);
        if (!['txt', 'epub'].includes(extension)) {
          if (path.endsWith('/')) path = path.substring(0, path.length - 1);
          foundFiles.push(`${path}/${file.name}`);
        }
      }
    }
    return foundFiles;
  }

  private _booksOfAuthor(folderPath: string, authorId: number, paths: string[]) {
    console.log('_booksOfAuthor')
    console.log(arguments)
    console.log(this.dir)
    console.log(this.dir.dir)
    if (folderPath.endsWith('/')) folderPath = folderPath.substring(0, folderPath.length - 1);
    Filesystem.readdir({
      directory: this.dir.dir,
      path: folderPath
    }).then(async item => {
      console.log(item)
      for (const file of item.files) {
        if (file.type === 'file') {
          const extension = file.name.substring(file.name.lastIndexOf('.') + 1);
          if (extension === 'txt' || extension === 'epub') {
            if (!paths.includes(`${folderPath}/${file.name}`) && !paths.includes(`${folderPath}${file.name}`)) {
              const id = authorId;
              const name = file.name.substring(0, file.name.lastIndexOf('.'));
              const book: BOOK = {
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
                path: `${folderPath}/${file.name}`,
                progress: null,
                rating: null,
                img: null,
                serie: null,
                serieOrder: null,
                dtbkId: null,
                lgId: null,
                cbdbId: null,
                added: new Date(),
                lastRead: null,
                finished: null
              };
              console.log('added book')
              console.log(book)
              this.db.addBook(book);
            }
          }
        } else {
          this._booksOfAuthor(folderPath + '/' + file.name, authorId, paths);
        }
      }
      this.ready2addBooks = true;
    }).catch((e) => {
      this.ready2addBooks = true;
      console.error('listDir failed: ');
      console.error(folderPath)
      console.error(e);
    });
  }

  public async readTextFile(fullPath: string): Promise<string> {
    console.log('readTextFile')
    console.log(arguments)
    const resp = await Filesystem.readFile({
      directory: this.dir.dir,
      path: fullPath,
      encoding: Encoding.UTF8
    });
    return resp.data as string;
  }

  public async downloadPicture(Uri: string, path: string, fileName: string): Promise<string> {
    console.log('downloadPicture')
    console.log(arguments)
    // const request: DownloadRequest = {
    //   uri: Uri,
    //   title: fileName.substring(fileName.lastIndexOf('/') + 1),
    //   description: '',
    //   mimeType: '',
    //   visibleInDownloadsUi: true,
    //   notificationVisibility: NotificationVisibility.VisibleNotifyCompleted,
    //   destinationInExternalPublicDir: {
    //     dirType: path,
    //     subPath: fileName,
    //   },
    // };

    if (path[0] === '/') {
      path = path.substring(1);
    }

    const uri = await Filesystem.getUri({
      directory: this.dir.dir,
      path: ''
    });

    if (path.endsWith('/')) path = path.substring(0, path.length - 1);

    const src = this.webView.convertFileSrc(`${uri.uri}/${path}/${fileName}`);

    return new Promise((resolve) => {
      Filesystem.stat({
        directory: this.dir.dir,
        path: path + fileName
      }).then(() => {
        resolve(src);
      }).catch(() => {
        Filesystem.downloadFile({
          directory: this.dir.dir,
          path: `${path}/${fileName}`,
          url: Uri
        }).then(a => {
          resolve(a.path);
        }).catch(e => {
          console.error(e);
        });
        // this.downloader.download(request).then((location) => {
        //   resolve(src);
        // }).catch((er) => {
        //   console.error(er);
        // });
      });
    });
  }

  public removeFile(path: string) {
    console.log('removeFile')
    console.log(arguments)
    return Filesystem.deleteFile({
      directory: this.dir.dir,
      path
    }).catch(e => {
      console.error(`removeFile on ${path} failed!`);
      throw e;
    });
  }

  public async write2File(text: string, dbVersion: number) {
    console.log('write2File')
    console.log(arguments)
    await Filesystem.writeFile({
      directory: this.dir.dir,
      path: `/ebook-library/db${dbVersion}_${new Date().toJSON()}.json`,
      data: text,
      encoding: Encoding.UTF8,
    }).then(a => console.log(a)).catch(e => console.error(e));
  }

  public async getDBJsons(): Promise<FileInfo[]> {
    console.log('getDBJsons')
    const data = await Filesystem.readdir({
      directory: this.dir.dir,
      path: 'ebook-library'
    });
    const files = data.files.filter(fl => /db.*\.json/.test(fl.name));
    return files;
  }

  public async downloadUnknownImg() {
    console.log('downloadUnknownImg')
    await Filesystem.stat({
      directory: this.dir.dir,
      path: '/ebook-library/unknown.jpg'
    }).catch(async () => {
      return Filesystem.downloadFile({
        directory: this.dir.dir,
        path: '/ebook-library/unknown.jpg',
        url: 'https://p1.hiclipart.com/preview/584/221/301/sword-art-online-vector-icons-help-unknown-png-icon-thumbnail.jpg'
      });
      // const request: DownloadRequest = {
      //   uri: 'https://p1.hiclipart.com/preview/584/221/301/sword-art-online-vector-icons-help-unknown-png-icon-thumbnail.jpg',
      //   title: 'unknown',
      //   description: '',
      //   mimeType: '',
      //   visibleInDownloadsUi: true,
      //   notificationVisibility: NotificationVisibility.VisibleNotifyCompleted,
      //   destinationInExternalPublicDir: {
      //     dirType: 'ebook-library',
      //     subPath: 'unknown.jpg',
      //   },
      // };
      // await this.downloader.download(request);
    });
  }

}
