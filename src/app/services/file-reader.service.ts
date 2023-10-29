import { Injectable } from '@angular/core';

import { Filesystem, Encoding, FileInfo, ReaddirResult } from '@capacitor/filesystem';

import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';

import { DirectoryService } from './directory.service';
import { DatabaseService } from 'src/app/services/database.service';

import { AUTHOR, BOOK } from 'src/app/services/interfaces';


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

  public async createEbookLibraryFolder() {
    console.log('createEbookLibraryFolder')
    return new Promise<void>((resolve) => {
      Filesystem.readdir({
        directory: this.dir.dir,
        path: ''
      }).then(item => {
        if (item.files.some(it => it.name === 'ebook-library')) resolve();
        else {
          Filesystem.mkdir({
            directory: this.dir.dir,
            path: 'ebook-library'
          }).then(() => {
            resolve();
          });
        }
      });
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

  public async downloadDorian(): Promise<any> {
    try {
      return await Filesystem.downloadFile({
        directory: this.dir.dir,
        path: 'ebook-library/Wilde, Oscar/The Picture of Dorian Gray.epub',
        url: 'https://www.gutenberg.org/ebooks/174.epub.noimages?session_id=931e40dbce8a034672c993b24b343cb40c0e667d'
      });
    } catch (e) {
      console.error('downloadDorian failed!');
      console.error(e);
    }
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
            let forename = '';
            if (name[1]) {
              forename = name[1].trim();
            }
            let authorId: number;

            try {
              const author = this.createAuthor({ forename, surname, path: `/ebook-library/${authorFolder.name}` });
              authorId = await this.db.addAuthor(author);
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

  private createAuthor(dt: { forename: string, surname: string, path: string }): AUTHOR {
    return {
      id: null, name: dt.forename, surname: dt.surname, pseudonym: null, nationality: null,
      birth: null, death: null, biography: null, img: null, rating: null, path: dt.path,
      idInJson: null, dtbkId: null, lgId: null, cbdbId: null, booksIds: null,
    };
  }

  public addBooksOfAuthor(authorId: number, path: string) {
    console.log('addBooksOfAuthor');
    console.log(authorId, path);
    if (this.ready2addBooks) {
      this.ready2addBooks = false;
      this.db.authorsBooksPaths(authorId).then((paths) => {
        this._booksOfAuthor(path, authorId, paths);
      });
    }
  }

  public async getNonBookFilesOfFolder(path: string): Promise<string[]> {
    console.log('getNonBookFilesOfFolder')
    console.log(path);
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

  private async _booksOfAuthor(folderPath: string, authorId: number, paths: string[]) {
    console.log('_booksOfAuthor')
    console.log(folderPath, authorId, paths);
    if (folderPath.endsWith('/')) folderPath = folderPath.substring(0, folderPath.length - 1);
    Filesystem.readdir({
      directory: this.dir.dir,
      path: folderPath
    }).then(async item => {
      console.log(item)
      for (const file of item.files) {
        if (file.type === 'file') {
          await this.addBook({ file, paths, folderPath, authorId });
        } else {
          await this._booksOfAuthor(folderPath + '/' + file.name, authorId, paths);
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

  private async addBook(dt: { file: FileInfo, paths: string[], folderPath: string, authorId: number },) {
    const extension = dt.file.name.substring(dt.file.name.lastIndexOf('.') + 1);
    if (extension !== 'txt' && extension !== 'epub') return;
    if (dt.paths.includes(`${dt.folderPath}/${dt.file.name}`) || dt.paths.includes(`${dt.folderPath}${dt.file.name}`)) return;
    const title = dt.file.name.substring(0, dt.file.name.lastIndexOf('.'));
    const book = this.createBook({ title, creatorIds: [dt.authorId], path: `${dt.folderPath}/${dt.file.name}` });
    console.log('added book')
    console.log(book)
    await this.db.addBook(book);
  }

  private createBook(dt: { title: string, creatorIds: number[], path: string }): BOOK {
    return {
      id: null, title: dt.title, creatorIds: dt.creatorIds, originalTitle: null, annotation: null,
      publisher: null, published: null, genre: null, length: null, language: 'cs-CZ', translator: null,
      ISBN: null, path: dt.path, progress: null, rating: null, img: null, serie: null, serieOrder: null,
      dtbkId: null, lgId: null, cbdbId: null, added: new Date(), lastRead: null, finished: null
    };
  }

  public async readTextFile(fullPath: string): Promise<string> {
    console.log('readTextFile')
    console.log(fullPath)
    const resp = await Filesystem.readFile({
      directory: this.dir.dir,
      path: fullPath,
      encoding: Encoding.UTF8
    });
    return resp.data as string;
  }

  public async downloadPicture(Uri: string, path: string, fileName: string): Promise<string> {
    console.log('downloadPicture');
    console.log(Uri, path, fileName);

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
      const pth = `/${path}/${fileName}`;
      Filesystem.stat({
        directory: this.dir.dir,
        path: pth
      }).then(() => {
        resolve(src);
      }).catch(() => {
        const filePath = pth.slice(0, pth.lastIndexOf('/')) + '/' + pth.slice(pth.lastIndexOf('/') + 1).replace(/[,:\s/]/g, '_');
        Filesystem.downloadFile({
          directory: this.dir.dir,
          path: filePath,
          url: Uri
        }).then(() => {
          resolve(filePath);
        }).catch(e => {
          console.error(e);
        });
      });
    });
  }

  public removeFile(path: string) {
    console.log('removeFile');
    console.log(path);
    return Filesystem.deleteFile({
      directory: this.dir.dir,
      path
    }).catch(e => {
      console.error(`removeFile on ${path} failed!`);
      throw e;
    });
  }

  public async write2File(text: string, dbVersion: number) {
    console.log('write2File');
    console.log(text, dbVersion);
    const path = `/ebook-library/db${dbVersion}_${new Date().toJSON().replace(/[,:\s/]/g, '_')}.json`;
    await Filesystem.writeFile({
      directory: this.dir.dir,
      path,
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
    });
  }

}
