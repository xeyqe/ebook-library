import { Injectable, OnInit } from '@angular/core';

import { Downloader, DownloadRequest, NotificationVisibility } from '@ionic-native/downloader/ngx';

import { Filesystem, Encoding } from '@capacitor/filesystem';

import { WebView } from '@ionic-native/ionic-webview/ngx';

import { DirectoryService } from './directory.service';
import { DatabaseService } from 'src/app/services/database.service';

import { BOOK } from 'src/app/services/interfaces';


@Injectable({
  providedIn: 'root',
})
export class FileReaderService implements OnInit {
  ready2addBooks = true;
  ready2addAuthors = true;

  constructor(
    private db: DatabaseService,
    private downloader: Downloader,
    private dir: DirectoryService,
    private webView: WebView,
  ) { }

  ngOnInit() {
  }

  public async createApplicationFolder() {
    return new Promise<void>((resolve) => {
      Filesystem.readdir({
        directory: this.dir.dir,
        path: ''
      }).then(item => {
        if (item.files.includes('ebook-library')) resolve();
        else {
          return Filesystem.mkdir({
            directory: this.dir.dir,
            path: 'ebook-library'
          }).then(() => {
            const request: DownloadRequest = {
              uri: 'https://www.gutenberg.org/ebooks/174.epub.noimages?session_id=931e40dbce8a034672c993b24b343cb40c0e667d',
              title: 'Dorian',
              description: '',
              mimeType: '',
              visibleInDownloadsUi: true,
              notificationVisibility: NotificationVisibility.VisibleNotifyCompleted,
              destinationInExternalPublicDir: {
                dirType: 'ebook-library/Wilde, Oscar',
                subPath: 'The Picture of Dorian Gray.epub',
              },
            };
            return this.downloader.download(request);
          });
        }
      });
    });
  }

  public async listOfAuthors() {
    try {
      if (this.ready2addAuthors) {
        this.ready2addAuthors = false;
        const allAuthorsPaths = await this.db.allAuthorsPaths();
        const foldersFiles = await Filesystem.readdir({
          directory: this.dir.dir,
          path: 'ebook-library'
        });
        const folders = [];
        for (const item of foldersFiles.files) {
          if (!await this.dir.isFile(`ebook-library/${item}`) && item !== 'epub')
            folders.push(item);
        }
        for (const authorFolder of folders) {
          if (!allAuthorsPaths.includes(`/ebook-library/${authorFolder}/`)) {
            const name = authorFolder.substring(authorFolder.lastIndexOf('/') + 1).split(',');
            const surname = name[0].trim();
            let firstName = '';
            if (name[1]) {
              firstName = name[1].trim();
            }
            const authorId = await this.db.addAuthor({
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
              path: `/ebook-library/${authorFolder}/`,
              idInJson: null,
            });
            this.db.authorsBooksPaths(authorId).then((paths) => {
              this._booksOfAuthor(`/ebook-library/${authorFolder}/`, authorId, paths);
            });
          }
        }

        this.ready2addAuthors = true;
      }
    } catch (e) {
      console.error('listOfAuthors failed!');
      throw new Error(JSON.stringify(e));
    }
  }

  public addBooksOfAuthor(authorId: number, path: string) {
    if (this.ready2addBooks) {
      this.ready2addBooks = false;
      this.db.authorsBooksPaths(authorId).then((paths) => {
        this._booksOfAuthor(path, authorId, paths);
      });
    }
  }

  private _booksOfAuthor(folderPath: string, authorId: number, paths: string[]) {
    Filesystem.readdir({
      directory: this.dir.dir,
      path: folderPath
    }).then(async item => {
      for (const file of item.files) {
        if (await this.dir.isFile(`${folderPath}/${file}`)) {
          const extension = file.substring(file.lastIndexOf('.') + 1);
          if (extension === 'txt' || extension === 'epub') {
            if (!paths.includes(folderPath + file)) {
              let book: BOOK;
              const id = authorId;
              const name = file.substring(0, file.lastIndexOf('.'));
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
                path: folderPath + file,
                progress: null,
                rating: null,
                img: null,
              };
              this.db.addBook(book);
            }
          }
        } else {
          this._booksOfAuthor(folderPath + '/' + file, authorId, paths);
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
    const resp = await Filesystem.readFile({
      directory: this.dir.dir,
      path: fullPath,
      encoding: Encoding.UTF8
    });
    return resp.data;
  }

  public async downloadPicture(Uri: string, path: string, fileName: string): Promise<string> {
    const request: DownloadRequest = {
      uri: Uri,
      title: fileName.substring(fileName.lastIndexOf('/') + 1),
      description: '',
      mimeType: '',
      visibleInDownloadsUi: true,
      notificationVisibility: NotificationVisibility.VisibleNotifyCompleted,
      destinationInExternalPublicDir: {
        dirType: path,
        subPath: fileName,
      },
    };

    if (path[0] === '/') {
      path = path.substring(1);
    }

    const uri = await Filesystem.getUri({
      directory: this.dir.dir,
      path: ''
    });

    const src = this.webView.convertFileSrc(uri.uri + '/' + path + fileName);

    return new Promise((resolve) => {
      Filesystem.stat({
        directory: this.dir.dir,
        path: path + fileName
      }).then(() => {
        resolve(src);
      }).catch(e => {
        this.downloader.download(request).then((location) => {
          resolve(src);
        }).catch((er) => {
          console.error(er);
        });
      });
    });
  }

  /**
   * removes a file
   * @param path path after ebook-library
   */
  public removeFile(path: string) {
    path = 'ebook-library' + path;

    return Filesystem.deleteFile({
      directory: this.dir.dir,
      path
    });
  }

  public async write2File(text: string, dbVersion: number) {
    await Filesystem.writeFile({
      directory: this.dir.dir,
      path: `ebook-library/db${dbVersion}_${new Date().toJSON()}.json`,
      data: text,
      encoding: Encoding.UTF8,
    });
  }

  public async getDBJsons(): Promise<string[]>  {
    const data = await Filesystem.readdir({
      directory: this.dir.dir,
      path: 'ebook-library'
    });
    const files = data.files.filter(fl => /db.*\.json/.test(fl)).map(fl => 'ebook-library/' + fl);
    return files;
  }

}
