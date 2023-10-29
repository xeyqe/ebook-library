import { Platform } from '@ionic/angular';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { Storage } from '@ionic/storage-angular';
import { SQLitePorter } from '@awesome-cordova-plugins/sqlite-porter/ngx';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

import { Encoding, Filesystem } from '@capacitor/filesystem';

import { DirectoryService } from './directory.service';
import { AUTHOR, BOOK, AUTHORSIMPLIFIED, BOOKSIMPLIFIED, DBJSON, AUTHORSBOOKS } from 'src/app/services/interfaces';


@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private version = 10;

  constructor(
    private dir: DirectoryService,
    private http: HttpClient,
    private plt: Platform,
    private sqlitePorter: SQLitePorter,
    private sqlite: SQLite,
    private storage: Storage,
  ) { }

  public async initializeDB() {
    try {
      await this.plt.ready();
      console.log('initializeDB platform is ready')
    } catch (e) {
      console.error('sqlite.create failed: ');
      throw e;
    }
    try {
      await this.storage.create();
      console.log('storage created');
    } catch (e) {
      console.error('this.storage.create failed');
      throw e;
    }
    let db: SQLiteObject;
    try {
      db = await this.sqlite.create({
        name: 'authors.db',
        location: 'default',
      });
      console.log('db created');
    } catch (e) {
      console.error('this.sqlite.create failed');
      throw e;
    }
    this.database = db;
    try {
      await this.seedDatabase();
    } catch (e) {
      console.error('seedDatabase');
      throw e;
    }
  }

  private async seedDatabase(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.http.get('assets/seed.sql', { responseType: 'text' }).subscribe({
        next: async (sql) => {
          try {
            await this.database.executeSql(
              'SELECT id FROM authors LIMIT 1',
              []
            );
            await this.takeCareOfUpdateDB().then(() => this.dbReady.next(true)).catch(e => {
              console.error('takeCareOfUpdateDB');
              reject(e);
            });
            resolve();
          } catch (e) {
            console.error(e);
            try {
              await this.sqlitePorter.wipeDb(this.database);
            } catch (e) {
              console.error(e);
            }
            await this.sqlitePorter.importSqlToDb(this.database, sql).then(() => {
              this.dbReady.next(true);
              resolve();
            }).catch((e) => {
              console.error(e)
              reject(e)
            });
          }
        },
        error: (e) => {
          console.error('assets/seed.sql');
          reject(e);
        }
      });
    });
  }

  private async takeCareOfUpdateDB() {
    await this.database.executeSql(
      'SELECT version FROM dbInfo',
      []
    ).then(data => {
      if (data.rows.item(0).version < this.version) {
        return this.setVersion(data.rows.item(0).version + 1);
      }
    }).catch(e => {
      console.error('takeCareOfUpdateDB')
      console.error(e)
      return this.setVersion(1);
    });
  }

  private async setVersion(version: number) {
    const json = await this.exportDB();
    const path = `ebook-library/db${version}_${new Date().toJSON().replace(/[,:\s/]/g, '_')}.json`;

    await Filesystem.writeFile({
      directory: this.dir.dir,
      path,
      data: JSON.stringify(json),
      encoding: Encoding.UTF8,
    });

    if (version === 1) {
      await this.database.executeSql(
        'CREATE TABLE IF NOT EXISTS dbInfo (version INTEGER PRIMARY KEY)', []
      );

      await this.database.executeSql(
        'INSERT INTO dbInfo (version) VALUES (1)', []
      );
      await this.updateDB(1);
    } else {
      console.log(`start updating db to version ${version}`)
      await this.updateDB(version);
      const oldVersion = await this.getVersion();
      await this.database.executeSql(
        'UPDATE dbInfo SET version = ? WHERE version = ?',
        [version, oldVersion]
      ).catch(e => {
        console.error(`UPDATE dbInfo SET version ${version} failed`);
        throw e;
      });
    }
    if (this.version > version) {
      return this.setVersion(version + 1);
    }
  }

  private updateDB(version: number) {
    const funName = `updateDB${version - 1}To${version}`;
    return this[funName]();
  }

  private async updateDB0To1() {
    await this.database.executeSql(
      `UPDATE authors SET img = SUBSTR(img, 47, LENGTH(img) - 46) WHERE img LIKE '%http://localhost/_app_file_/storage/emulated/0%'`, []
    );

    await this.database.executeSql(
      `UPDATE books SET img = SUBSTR(img, 47, LENGTH(img) - 46) WHERE img LIKE '%http://localhost/_app_file_/storage/emulated/0%'`, []
    );
  }

  private async updateDB1To2() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN pseudonym TEXT', []
    ).catch(e => {
      console.error('updateDB1To2 failed');
      throw e;
    });
  }

  private async updateDB2To3() {
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN serie TEXT', []
    ).catch(e => {
      console.error('adding serie failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN serieOrder INTEGER', []
    ).catch(e => {
      console.error('adding serieOrder failed');
      throw e;
    });
  }

  private async updateDB3To4() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN dtbkId TEXT', []
    ).catch(e => {
      console.error('adding dtbkId to authors failed');
      throw e;
    });
  }

  private async updateDB4To5() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN lgId TEXT', []
    ).catch(e => {
      console.error('adding lgId to authors failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN lgId TEXT', []
    ).catch(e => {
      console.error('adding lgId to books failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN dtbkId TEXT', []
    ).catch(e => {
      console.error('adding dtbkId to books failed');
      throw e;
    });
  }

  private async updateDB5To6() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN cbdbId TEXT', []
    ).catch(e => {
      console.error('adding cbdbId to authors failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN cbdbId TEXT', []
    ).catch(e => {
      console.error('adding cbdbId to books failed');
      throw e;
    });
  }

  private async updateDB6To7() {
    await this.database.executeSql(
      `ALTER TABLE books ADD COLUMN added TEXT`, []
    ).catch(e => {
      console.error('adding added to books failed');
      throw e;
    });
    await this.database.executeSql(
      `UPDATE books SET added = '2000-01-01 00:00:00.000' WHERE added IS NULL`, []
    ).catch(e => {
      console.error('initializing added in books failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN lastRead TEXT', []
    ).catch(e => {
      console.error('adding lastRead to books failed');
      throw e;
    });
    await this.database.executeSql(
      `UPDATE books SET lastRead = '2001-01-01 00:00:00.000' WHERE lastRead IS NULL AND progress IS NOT NULL`, []
    ).catch(e => {
      console.error('initializing lastRead in books failed');
      throw e;
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN finished TEXT', []
    ).catch(e => {
      console.error('adding finished to books failed');
      throw e;
    });
    await this.database.executeSql(
      `UPDATE books SET finished = '2001-01-02 00:00:00.000' WHERE finished IS NULL AND progress = 'finished'`, []
    ).catch(e => {
      console.error('initializing finished in books failed');
      throw e;
    });
  }

  private async updateDB7To8() {
    await this.database.executeSql(
      `UPDATE books SET progress = '1/1' WHERE finished IS NOT NULL AND progress = 'finished'`, []
    ).catch(e => {
      console.error('initializing finished in books failed');
      throw e;
    });
  }

  private async updateDB8To9() {
    let creatorsIdsDt;
    try {
      creatorsIdsDt = await this.database.executeSql(
        `SELECT id, creatorId FROM books WHERE creatorId is NOT NULL`
      );
    } catch (e) {
      creatorsIdsDt = e;
    }

    const creatorsIdsObj: { creatorId: number[] } = {} as any;
    for (let i = 0; i < creatorsIdsDt.rows.length; i++) {
      const creatorId = creatorsIdsDt.rows.item(i).creatorId;
      const bookId = creatorsIdsDt.rows.item(i).id
      if (!creatorsIdsObj[creatorId]) creatorsIdsObj[creatorId] = [bookId];
      else creatorsIdsObj[creatorId] = [...creatorsIdsObj[creatorId], bookId];
    }

    try {
      await this.database.executeSql(
        `ALTER TABLE authors ADD COLUMN booksIds TEXT`, []
      );
    } catch (e) {
      console.error('adding booksIds to authors failed');
      console.error(e)
    }

    for (const creatorId of Object.keys(creatorsIdsObj)) {
      try {
        await this.database.executeSql(
          `UPDATE authors SET booksIds = ? WHERE id = ?`,
          [creatorsIdsObj[creatorId].join(), creatorId]
        );
      } catch (e) {
        console.error(`setting booksIds to ${creatorsIdsObj[creatorId].join()} for ${creatorId}!`);
        console.error(e);
      }
    }

    const books = await this.getUpdatedBooks();

    try {
      await this.database.executeSql(`DROP TABLE IF EXISTS books`);
    } catch (e) {
      console.error(e);
    }
    try {
      await this.database.executeSql(`CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY AUTOINCREMENT, creatorIds TEXT, title TEXT, originalTitle TEXT, annotation TEXT, publisher TEXT, published INTEGER, genre TEXT, length INTEGER, language TEXT, translator TEXT, ISBN TEXT, path TEXT, progress TEXT, rating INTEGER, img TEXT, serie TEXT, serieOrder INTEGER, dtbkId TEXT, lgId TEXT, cbdbId TEXT, added TEXT, lastRead TEXT, finished TEXT)`);
    } catch (e) {
      console.error(e);
    }

    for (const book of books) {
      const keys = Object.keys(book).join(', ');
      const params = Object.values(book);
      const questionMarks = new Array(params.length).fill('?').join(', ')
      try {
        await this.database.executeSql(`INSERT INTO books (${keys}) VALUES(${questionMarks})`, params);
      } catch (e) {
        console.error(e)
      }
    }

  }

  private async updateDB9To10() {
    await this.database.executeSql(
      `UPDATE authors SET img = NULL WHERE img = '/ebook-library/unknown.jpg'`, []
    ).catch(e => {
      console.error('update img of authors failed');
      throw e;
    });
    await this.database.executeSql(
      `UPDATE books SET img = NULL WHERE img = '/ebook-library/unknown.jpg'`, []
    ).catch(e => {
      console.error('update img of books failed');
      throw e;
    });
  }

  private async getUpdatedBooks() {
    let data;
    try {
      data = await this.database.executeSql(
        `SELECT * from books`
      );
    } catch (e) {
      console.error(e);
      data = e;
    }
    const books = [];

    for (let i = 0; i < data.rows.length; i++) {
      const book = {};
      [
        'id', 'title', 'creatorIds', 'originalTitle', 'annotation', 'publisher', 'published', 'genre',
        'length', 'language', 'translator', 'ISBN', 'path', 'progress', 'rating', 'img', 'serie',
        'serieOrder', 'dtbkId', 'lgId', 'cbdbId', 'lastRead', 'added', 'finished'
      ].forEach(key => {
        const item = data.rows.item(i);
        let val = item[key];
        if (key === 'creatorIds') val = typeof item.creatorId === 'number' ? ('' + item.creatorId) : null;
        book[key] = val;
      });
      books.push(book);
    }
    return books;
  }

  public exportDB(): Promise<any> {
    return this.sqlitePorter.exportDbToJson(this.database).catch(e => {
      console.error('exportDbToJson failed!');
      throw e;
    });
  }

  public async importDB(json: string, characted: string): Promise<any> {
    try {
      await this.sqlitePorter.wipeDb(this.database);
      console.log('this.database successfully wiped');
    } catch (e) {
      console.error('wiping db failed')
      console.error(e);
    }

    try {
      const dbJson: DBJSON = JSON.parse(json);
      await this.initializeDb(dbJson.structure.tables);
      try {
        await this.database.executeSql('INSERT INTO dbInfo (version) VALUES(?)', [dbJson.data.inserts.dbInfo[0].version])
      } catch (e) {
        console.error(e)
      }
      for (const author of dbJson.data.inserts.authors) {
        try {
          const params = Object.values(author);
          const questionMarks = new Array(params.length).fill('?').join(', ')
          await this.database.executeSql(`INSERT or IGNORE INTO authors VALUES(${questionMarks})`, params);
          console.log(`author ${author.name} ${author.surname} added to db`)
        } catch (e) {
          console.error(`author ${author.name} ${author.surname} failed to add to the db`)
          console.error(e)
        }
      }
      for (const book of dbJson.data.inserts.books) {
        try {
          const params = Object.values(book);
          const questionMarks = new Array(params.length).fill('?').join(', ')
          await this.database.executeSql(`INSERT or IGNORE INTO books VALUES(${questionMarks})`, params);
          console.log(`book ${book.title} added to the db`)
        } catch (e) {
          console.error(`book ${book.title} failed to be added to the db`)
          console.error(e);
        }
      }

    } catch (e) {
      console.error('db exported to json')
      console.error(e)
    }
    try {
      await this.takeCareOfUpdateDB();
      console.log('db has been taken care of');
    } catch (e) {
      console.error('takeCareOfUpdateDB failed')
      console.error(e)
    }
    try {
      await this.loadAuthors(characted);
    } catch (e) {
      console.error('loading authors failed');
      console.error(e);
    }
  }

  private async initializeDb(tables: { authors: string; books: string; dbInfo: string; }) {
    if (!tables?.authors || !tables?.books || !tables?.dbInfo) return;
    for (const key of Object.keys(tables)) {
      console.log(`creating table ${key}`)
      try {
        await this.database.executeSql(`CREATE TABLE ${key}${tables[key].replace(/[\s]{2,}/g, ' ').replace(/\n/g, '')}`);
      } catch (e) {
        console.error(e);
      }
    }
  }

  getDatabaseState(): Observable<boolean> {
    return this.dbReady.asObservable();
  }

  public async loadAuthors(character: string): Promise<AUTHORSIMPLIFIED[]> {
    try {
      let data: any;
      if (character === '#') {
        data = await this.database.executeSql(
          `SELECT id, name, surname, img FROM authors ORDER BY surname COLLATE NOCASE ASC`,
          []
        ).catch(e => {
          console.error('loadAuthors for # failed');
          throw e;
        });
      } else {
        data = await this.database.executeSql(
          `SELECT id, name, surname, img FROM authors WHERE surname LIKE "${character}%" ORDER BY surname COLLATE NOCASE ASC`,
          []
        ).catch(e => {
          console.error('loadAuthors failed');
          throw e;
        });
      }
      let authors = [];

      if (data.rows.length > 0) {
        for (let i = 0; i < data.rows.length; i++) {
          authors.push({
            id: data.rows.item(i).id,
            name: data.rows.item(i).name,
            surname: data.rows.item(i).surname,
            img: data.rows.item(i).img,
          });
        }
      }
      if (character === '#') {
        authors = authors.filter(auth => !/^[a-zA-Z]$/.test(auth.surname[0]));
      }
      return authors;
      // this.authors.next(authors);
    } catch (e) {
      console.error('loadAuthors failed: ');
      console.error(e);
    }
  }

  public async addAuthor(author: AUTHOR): Promise<number> {
    if (!author) throw new Error('Wrong input!');
    if (author.booksIds?.length) author.booksIds = author.booksIds.join() as any;
    const keys = Object.keys(author).join(', ');
    const params = Object.values(author);
    const questionMarks = new Array(params.length).fill('?').join(', ');

    const output = await this.database.executeSql(
      `INSERT INTO authors (${keys}) VALUES (${questionMarks})`, params
    ).catch(e => {
      console.error('addAuthor failed!');
      throw e;
    });

    return output.insertId;
  }

  public async getAuthor(id: number): Promise<AUTHOR> {
    const data = await this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]).catch(e => {
      console.error('getAuthor failed!');
      throw e;
    });
    const output = {} as any;
    const item = data.rows.item(0);
    console.log(item)
    Object.keys(item).forEach(key => {
      output[key] = item[key];
    });
    if (output.biography) output.biography = output.biography.replace(/<br>/g, '\n')
    if (output.booksIds) output.booksIds = output.booksIds.split(',').map(it => +it);
    console.log(output)
    return output;
  }

  public async findAuthors(searchValue: string): Promise<AUTHORSIMPLIFIED[]> {
    let data;
    try {
      data = await this.database.executeSql(
        `SELECT id, name, surname, pseudonym, img FROM authors WHERE name LIKE "%${searchValue}%" OR surname LIKE "%${searchValue}%" OR pseudonym LIKE "%${searchValue}%" ORDER BY surname COLLATE NOCASE ASC`,
        []
      );
    } catch (e) {
      console.error('findAuthors failed!');
      console.error(e);
      data = e;
    }
    const authors: AUTHORSIMPLIFIED[] = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        authors.push({
          id: data.rows.item(i).id,
          name: data.rows.item(i).name,
          surname: data.rows.item(i).surname,
          pseudonym: data.rows.item(i).pseudonym,
          img: data.rows.item(i).img
        });
      }
    }
    return authors;
  }

  public async findBooks(searchValue: string): Promise<BOOKSIMPLIFIED[]> {
    const data = await this.database.executeSql(
      `SELECT id, title, progress, img, rating creatorIds FROM books WHERE title LIKE "%${searchValue}%" OR originalTitle LIKE "%${searchValue}%" ORDER BY title COLLATE NOCASE ASC`,
      []
    ).catch(e => {
      console.error('findAuthors failed!');
      throw e;
    });
    const books: BOOKSIMPLIFIED[] = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        books.push({
          id: data.rows.item(i).id,
          title: data.rows.item(i).title,
          progress: data.rows.item(i).progress,
          img: data.rows.item(i).img,
          rating: data.rows.item(i).rating,
          creatorIds: data.rows.item(i).creatorIds
        });
      }
    }
    return books;
  }

  public async getBooksOfAuthor(ids: number[]): Promise<AUTHORSBOOKS[]> {
    console.log(ids);
    if (!ids?.length) return;
    let data;
    try {
      data = await this.database.executeSql(`SELECT id, title, creatorIds, progress, img, serie, serieOrder FROM books WHERE id IN ( ${ids.join(', ')} ) ORDER BY title ASC`);
    } catch (e) {
      console.error('getBooksOfAuthor failed!');
      data = e;
    }
    return this.getAuthorsBooks(data);
  }

  private getAuthorsBooks(data: any): AUTHORSBOOKS[] {
    const books: AUTHORSBOOKS[] = [];
    if (!data.rows?.length) return;
    for (let i = 0; i < data.rows.length; i++) {
      books.push({
        id: data.rows.item(i).id,
        title: data.rows.item(i).title,
        creatorIds: data.rows.item(i).creatorIds?.split(',').map(it => +it),
        progress: data.rows.item(i).progress,
        img: data.rows.item(i).img,
        serie: data.rows.item(i).serie,
        serieOrder: data.rows.item(i).serieOrder,
      });
    }
    return books;
  }

  public async getSeriesBooks(seriesNames: string[], authorId: number): Promise<{ [serieName: string]: AUTHORSBOOKS[] }> {
    if (!seriesNames?.length || !authorId) throw new Error('Wrong input to getSeriesBooks');
    const output: { [serieName: string]: AUTHORSBOOKS[] } = {};

    for (const serie of seriesNames) {
      const data = await this.database.executeSql(
        'SELECT id, title, creatorIds, progress, img, serie, serieOrder FROM books WHERE creatorIds IS NOT ? AND serie == ? ORDER BY title ASC',
        [authorId, serie]
      ).catch(e => {
        console.error(`getSeriesBooks for "${serie}" failed!`);
        throw e;
      });
      if (!data?.rows?.length) break;
      output[serie] = this.getAuthorsBooks(data);
    }

    return output;

  }

  public async isBookFileUsedInDifferentBook(path: string, id: number): Promise<boolean> {
    let outputId: boolean;
    try {
      outputId = !!await this.database.executeSql('SELECT id FROM books WHERE path = ? AND id != ?', [path, id]);
    } catch (e) {
      console.error('isBookFileUsedInDifferentBook failed');
      console.error(e);
      throw e;
    }
    return outputId;
  }

  public async getBook(id: number): Promise<BOOK> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE id = ?', [id]);
    const obj = data.rows.item(0);
    if (obj.creatorIds) obj.creatorIds = obj.creatorIds.split(',').map(it => +it);
    ['added', 'lastRead', 'finished'].forEach(key => {
      if (obj[key]) obj[key] = new Date(obj[key]);
    });
    console.log(obj);
    return obj;
  }

  public async deleteAuthor(id: number) {
    const author = await this.getAuthor(id);
    for (const bookId of author.booksIds || []) {
      const book = await this.getBook(bookId);
      if (book.creatorIds.length !== 1) continue;
      if (book.creatorIds[0] === id)
        await this.deleteBook(book.id);
      else
        await this.updateBook({ ...book, creatorIds: book.creatorIds.filter(it => it !== id) })
    }
    await this.database.executeSql('DELETE FROM authors WHERE id = ?', [id]);
  }

  public async deleteBook(bookId: number) {
    const book = await this.getBook(bookId);
    for (const authorId of book.creatorIds) {
      const author = await this.getAuthor(authorId);
      await this.updateAuthor({ ...author, booksIds: author.booksIds.filter(it => it !== bookId) });
    }
    if (book.img && book.img.startsWith('/')) {
      const other = await this.database.executeSql(`SELECT id FROM books WHERE img = ${book.img}`);
      if (!other.rows.length) {
        await Filesystem.deleteFile({
          directory: this.dir.dir,
          path: book.img
        });
      }

    }
    await this.database.executeSql('DELETE FROM books WHERE id = ?', [bookId]);
  }

  public async updateAuthor(author: AUTHOR) {
    if (author.biography) author.biography.replace(/\n/g, '<br>');
    if (author.booksIds?.length) author.booksIds = author.booksIds.join() as any;
    const id = author.id;
    delete author.id;
    const keys = Object.keys(author).map(it => `${it} = ?`).join(', ');
    const params = Object.values(author);

    await this.database.executeSql(`UPDATE authors SET ${keys} WHERE id = ${id}`, params);
  }

  public async addBook(book: BOOK) {
    ['added', 'lastRead', 'finished'].forEach(key => {
      if (book[key]) book[key] = this.dt2Str(book[key]);
    });
    if (book.creatorIds) book.creatorIds = book.creatorIds.join() as any;
    const keys = Object.keys(book).join(', ');
    const params = Object.values(book);
    const questionMarks = new Array(params.length).fill('?').join(', ');

    try {
      const output = await this.database.executeSql(
        `INSERT INTO books (${keys}) VALUES (${questionMarks})`, params
      );
      if (book.creatorIds) {
        const creatorIds = (book.creatorIds as any).split(',').map(it => +it);
        for (const authorId of creatorIds) {
          const author = await this.getAuthor(authorId);
          if (!author.booksIds?.includes(output.insertId)) {
            const booksIds = [output.insertId];
            if (author.booksIds?.length) booksIds.push(...author.booksIds);
            booksIds.sort();
            await this.updateAuthor({ ...author, booksIds });
          }
        }
      }
    } catch (e) {
      console.error('cannot add a book');
      console.error(e);
    }
  }

  private dt2Str(date: Date): string {
    if (!date || !(date instanceof Date)) return null;
    const [
      years, months, days, hours, minutes, seconds, milliseconds
    ] = date.toISOString().replace(/[-:.ZT]/g, '/').split('/');

    return `${years}-${months}-${days} ${hours}:${minutes}:${seconds}:${milliseconds}`;
  }

  public async updateBookProgress(id: number, progress: string) {
    try {
      await this.database.executeSql(
        'UPDATE books SET progress = ? WHERE id = ?',
        [progress, id]
      );

    } catch (e) {
      console.error('updateBookProgress failed');
      throw e;
    }
  }

  public async updateBookLastRead(id: number, lastRead: Date) {
    if (!(lastRead instanceof Date)) return;
    try {
      await this.database.executeSql(
        'UPDATE books SET lastRead = ? WHERE id = ?',
        [this.dt2Str(lastRead), id]
      );

    } catch (e) {
      console.error('updateBookLastRead failed');
      throw e;
    }
  }

  public async updateBookFinished(id: number, finished: Date) {
    if (!(finished instanceof Date)) return;
    try {
      await this.database.executeSql(
        'UPDATE books SET finished = ? WHERE id = ? AND finished IS NULL',
        [this.dt2Str(finished), id]
      );

    } catch (e) {
      console.error('updateBookFinished failed');
      throw e;
    }
  }

  public async updateBook(book: BOOK) {
    if (!book) throw new Error('No book to update!');
    const id = book.id;
    delete book.id;
    try {
      book.creatorIds = book.creatorIds?.length ? book.creatorIds.join() : null as any;
    } catch (e) {
      console.error(book.creatorIds);
      console.error(e);
      book.creatorIds = book.creatorIds?.length ? book.creatorIds : null as any;
    }
    ['lastRead', 'added', 'finished'].forEach(key => {
      if (book[key]) book[key] = this.dt2Str(book[key]);
    });
    const values = Object.keys(book).map(it => `${it} = ?`).join(', ');

    const params = Object.values(book);

    await this.database.executeSql(
      `UPDATE books SET ${values} WHERE id = ${id}`,
      params
    );
  }

  private getBookSimplified(book: BOOK): BOOKSIMPLIFIED {
    return {
      id: book.id,
      title: book.title,
      img: book.img,
      progress: book.progress,
      rating: book.rating,
      creatorIds: book.creatorIds,
    }
  }

  public async allAuthorsPaths(): Promise<string[]> {
    const data = await this.database.executeSql('SELECT path FROM authors', []).catch(e => {
      console.error('allAuthorsPaths select failed.');
      throw new Error(e);
    });
    const paths = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        paths.push(data.rows.item(i).path);
      }
    }
    return paths;
  }

  public async authorsBooksPaths(authorId: number): Promise<string[]> {
    const data = await this.database.executeSql(
      'SELECT path FROM books WHERE creatorIds = ?',
      [authorId]
    ).catch(e => {
      console.error('authorsBooksPaths failed!');
      throw e;
    });
    const paths = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        paths.push(data.rows.item(i).path);
      }
    }
    return paths;
  }

  public async loadBooks(type: 'liked' | 'started' | 'finished'): Promise<BOOKSIMPLIFIED[]> {
    let books = [];
    if (type === 'liked') {
      books = await this.getLikedBooks();
    } else if (type === 'started') {
      books = await this.getStartedBooks();
    } else if (type === 'finished') {
      books = await this.getFinishedBooks();
    }
    console.log(books)
    return books;
  }

  public async getStartedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorIds: number,
  }[]> {
    const data = await this.database.executeSql(
      'SELECT id, title, progress, img, creatorIds FROM books WHERE lastRead IS NOT NULL AND finished IS NULL ORDER BY lastRead DESC, title COLLATE NOCASE ASC',
      []
    ).catch((e) => {
      console.error('getStartedBooks failed!');
      throw e;
    });

    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getFinishedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorIds: number,
  }[]> {
    const data = await this.database.executeSql(
      `SELECT id, title, progress, img, creatorIds FROM books WHERE finished is NOT NULL ORDER BY finished DESC, title COLLATE NOCASE ASC`,
      []
    ).catch((e) => {
      console.error('getFinishedBooks failed!');
      throw e;
    });
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getLikedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorIds: number,
  }[]> {
    const data = await this.database.executeSql(
      'SELECT id, title, progress, img, creatorIds FROM books WHERE rating > 2 ORDER BY title COLLATE NOCASE ASC',
      []
    ).catch((e) => {
      console.error('getLikedBooks failed!');
      throw e;
    });
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  private getReducedBooksFromSqlRows(rows: any): {
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorIds: number,
  }[] {
    const books = [];
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        books.push({
          id: rows.item(i).id,
          title: rows.item(i).title,
          progress: rows.item(i).progress,
          img: rows.item(i).img,
          creatorIds: rows.item(i).creatorIds
        });
      }
    }
    return books;
  }

  public saveValue(name: string, value: any) {
    this.storage.set(name, value).catch((e) => {
      console.error(`saveValue failed! name: ${name}, value: ${value}`);
      throw e;
    });
  }

  public getValue(name: string): Promise<any> {
    return this.storage.get(name).catch((e) => {
      console.error(`getValue failed! name: ${name}`);
      throw e;
    });
  }

  public async getVersion() {
    const data = await this.database.executeSql(
      'SELECT version FROM dbInfo',
      []
    ).catch((e) => {
      console.error('getVersion failed!');
      throw e;
    });
    return data.rows.item(0).version;
  }
}
