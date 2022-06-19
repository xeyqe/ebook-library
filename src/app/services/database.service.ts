import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { Storage } from '@ionic/storage-angular';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite/ngx';

import { Encoding, Filesystem } from '@capacitor/filesystem';

import { DirectoryService } from './directory.service';
import { AUTHOR, BOOK, AUTHORSIMPLIFIED, BOOKSIMPLIFIED } from 'src/app/services/interfaces';
import { Platform } from '@ionic/angular';


@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private version = 6;

  authors = new BehaviorSubject<AUTHORSIMPLIFIED[]>([]);
  books = new BehaviorSubject([]);
  allBooks = new BehaviorSubject<BOOKSIMPLIFIED[]>([]);

  constructor(
    private dir: DirectoryService,
    private http: HttpClient,
    private plt: Platform,
    private sqlitePorter: SQLitePorter,
    private sqlite: SQLite,
    private storage: Storage,
  ) { }

  public async initializeDB() {
    await this.plt.ready().catch((e) => {
      console.error('sqlite.create failed: ');
      throw new Error(e);
    });
    await this.storage.create().catch(e => {
      console.error('this.storage.create failed');
      throw new Error(e);
    });
    const db = await this.sqlite.create({
      name: 'authors.db',
      location: 'default',
    }).catch(e => {
      console.error('this.sqlite.create failed');
      throw new Error(JSON.stringify(e));
    });
    this.database = db;
    this.seedDatabase();
  }

  private async seedDatabase() {
    this.http.get('assets/seed.sql', { responseType: 'text' }).subscribe({
      next: async (sql) => {
        try {
          await this.database.executeSql(
            'SELECT id FROM authors LIMIT 1',
            []
          );
          await this.takeCareOfUpdateDB().then(() => this.dbReady.next(true)).catch(e => {
            console.error('takeCareOfUpdateDB');
            throw new Error(JSON.stringify(e));
          });
        } catch (e) {
          this.sqlitePorter.importSqlToDb(this.database, sql).then(async () => {
            this.dbReady.next(true);
          }).catch((e) => console.error(e));
        }
      },
      error: (e) => {
        console.error('assets/seed.sql');
        throw new Error(e);
      }
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
    await Filesystem.writeFile({
      directory: this.dir.dir,
      path: `ebook-library/db${version}_${new Date().toJSON()}.json`,
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
      await this.updateDB(version);
      await this.database.executeSql(
        'UPDATE dbInfo SET version = ?',
        [version]
      ).catch(e => {
        console.error(`UPDATE dbInfo SET version ${version} failed`);
        throw new Error(JSON.stringify(e));
      });
    }
    if (this.version > version) {
      return this.setVersion(version + 1);
    }
  }

  private updateDB(version: number) {
    const funName = `updateDB${version - 1}To${version}`;
    // if (!this['funName']) throw new Error(`${funName} not implemented yet.`); // doesn't working in production
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
      throw new Error(JSON.stringify(e));
    });
  }

  private async updateDB2To3() {
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN serie TEXT', []
    ).catch(e => {
      console.error('adding serie failed');
      throw new Error(JSON.stringify(e));
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN serieOrder INTEGER', []
    ).catch(e => {
      console.error('adding serieOrder failed');
      throw new Error(JSON.stringify(e));
    });
  }

  private async updateDB3To4() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN dtbkId TEXT', []
    ).catch(e => {
      console.error('adding dtbkId to authors failed');
      throw new Error(JSON.stringify(e));
    });
  }

  private async updateDB4To5() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN lgId TEXT', []
    ).catch(e => {
      console.error('adding lgId to authors failed');
      throw new Error(JSON.stringify(e));
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN lgId TEXT', []
    ).catch(e => {
      console.error('adding lgId to books failed');
      throw new Error(JSON.stringify(e));
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN dtbkId TEXT', []
    ).catch(e => {
      console.error('adding dtbkId to books failed');
      throw new Error(JSON.stringify(e));
    });
  }

  private async updateDB5To6() {
    await this.database.executeSql(
      'ALTER TABLE authors ADD COLUMN cbdbId TEXT', []
    ).catch(e => {
      console.error('adding cbdbId to authors failed');
      throw new Error(JSON.stringify(e));
    });
    await this.database.executeSql(
      'ALTER TABLE books ADD COLUMN cbdbId TEXT', []
    ).catch(e => {
      console.error('adding cbdbId to books failed');
      throw new Error(JSON.stringify(e));
    });
  }

  public exportDB(): Promise<any> {
    return this.sqlitePorter.exportDbToJson(this.database).catch(e => {
      console.error('exportDbToJson failed!');
      throw new Error(JSON.stringify(e));
    });
  }

  public async importDB(json: string): Promise<any> {
    await this.sqlitePorter.wipeDb(this.database);
    await this.sqlitePorter.importJsonToDb(this.database, json);
    await this.takeCareOfUpdateDB();
  }

  getDatabaseState(): Observable<boolean> {
    return this.dbReady.asObservable();
  }

  getAuthors(): BehaviorSubject<AUTHORSIMPLIFIED[]> {
    return this.authors;
  }

  getBooks(): Observable<BOOK[]> {
    return this.books.asObservable();
  }

  public getAllBooks(): BehaviorSubject<BOOKSIMPLIFIED[]> {
    return this.allBooks;
  }

  public async loadAuthors(character: string) {
    try {
      let data: any;
      if (character === '#') {
        data = await this.database.executeSql(
          `SELECT id, name, surname, img FROM authors ORDER BY surname COLLATE NOCASE ASC`,
          []
        ).catch(e => {
          console.error('loadAuthors for # failed');
          throw new Error(JSON.stringify(e));
        });
      } else {
        data = await this.database.executeSql(
          `SELECT id, name, surname, img FROM authors WHERE surname LIKE "${character}%" ORDER BY surname COLLATE NOCASE ASC`,
          []
        ).catch(e => {
          console.error('loadAuthors failed');
          throw new Error(JSON.stringify(e));
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
      this.authors.next(authors);
    } catch (e) {
      console.error('loadAuthors failed: ');
      console.error(e);
    }
  }

  public async addAuthor(author: AUTHOR): Promise<number> {
    const data = [
      author.name,
      author.surname,
      author.pseudonym,
      author.nationality,
      author.birth,
      author.death,
      author.biography,
      author.img,
      author.rating,
      author.path,
      author.dtbkId,
      author.lgId,
      author.cbdbId,
    ];
    const output = await this.database.executeSql(
      `INSERT INTO authors
          (name, surname, pseudonym, nationality, birth, death, biography, img, rating, path, dtbkId, lgId, cbdbId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data
    ).catch(e => {
      console.error('addAuthor failed!');
      throw new Error(JSON.stringify(e));
    });
    author.id = output.insertId;
    const athrs = this.authors.getValue();
    athrs.push({ name: author.name, surname: author.surname, pseudonym: author.pseudonym, img: author.img, id: author.id });
    this.authors.next(athrs);
    return output.insertId;
  }

  public async getAuthor(id: number): Promise<AUTHOR> {
    const data = await this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]).catch(e => {
      console.error('getAuthor failed!');
      throw new Error(JSON.stringify(e));
    });
    return {
      id: data.rows.item(0).id,
      name: data.rows.item(0).name,
      surname: data.rows.item(0).surname,
      nationality: data.rows.item(0).nationality,
      pseudonym: data.rows.item(0).pseudonym,
      birth: data.rows.item(0).birth,
      death: data.rows.item(0).death,
      biography: data.rows.item(0).biography
        ? data.rows.item(0).biography.replace(/<br>/g, '\n')
        : data.rows.item(0).biography,
      img: data.rows.item(0).img,
      rating: data.rows.item(0).rating,
      path: data.rows.item(0).path,
      idInJson: data.rows.item(0).idInJson,
      dtbkId: data.rows.item(0).dtbkId,
      lgId: data.rows.item(0).lgId,
      cbdbId: data.rows.item(0).cbdbId,
    };
  }

  public async findAuthors(searchValue: string): Promise<void> {
    const data = await this.database.executeSql(
      `SELECT id, name, surname, pseudonym, img FROM authors WHERE name LIKE "%${searchValue}%" OR surname LIKE "%${searchValue}%" OR pseudonym LIKE "%${searchValue}%" ORDER BY surname COLLATE NOCASE ASC`,
      []
    ).catch(e => {
      console.error('findAuthors failed!');
      throw new Error(JSON.stringify(e));
    });
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
    this.authors.next(authors);
  }

  public async findBooks(searchValue: string): Promise<void> {
    const data = await this.database.executeSql(
      `SELECT id, title, progress, img, rating creatorId FROM books WHERE title LIKE "%${searchValue}%" OR originalTitle LIKE "%${searchValue}%" ORDER BY title COLLATE NOCASE ASC`,
      []
    ).catch(e => {
      console.error('findAuthors failed!');
      throw new Error(JSON.stringify(e));
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
          creatorId: data.rows.item(i).creatorId
        });
      }
    }
    this.allBooks.next(books);
  }

  public async getBooksOfAuthor(id: number): Promise<any> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE creatorId = ? ORDER BY title ASC', [id]).catch(e => {
      console.error('getBooksOfAuthor failed!');
      throw new Error(JSON.stringify(e));
    });
    const books: BOOK[] = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        books.push({
          id: data.rows.item(i).id,
          title: data.rows.item(i).title,
          creatorId: data.rows.item(i).creatorId,
          originalTitle: data.rows.item(i).originalTitle,
          annotation: data.rows.item(i).annotation,
          publisher: data.rows.item(i).publisher,
          published: data.rows.item(i).published,
          genre: data.rows.item(i).genre,
          length: data.rows.item(i).length,
          language: data.rows.item(i).language,
          translator: data.rows.item(i).translator,
          ISBN: data.rows.item(i).ISBN,
          path: data.rows.item(i).path,
          progress: data.rows.item(i).progress,
          rating: data.rows.item(i).rating,
          img: data.rows.item(i).img,
          serie: data.rows.item(i).serie,
          serieOrder: data.rows.item(i).serieOrder,
          dtbkId: data.rows.item(i).dtbkId,
          lgId: data.rows.item(i).lgId,
          cbdbId: data.rows.item(i).cbdbId,
        });
      }
    }
    this.books.next(books);
  }

  public async getBook(id: number): Promise<BOOK> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE id = ?', [id]);
    return {
      id: data.rows.item(0).id,
      title: data.rows.item(0).title,
      creatorId: data.rows.item(0).creatorId,
      originalTitle: data.rows.item(0).originalTitle,
      annotation: data.rows.item(0).annotation,
      publisher: data.rows.item(0).publisher,
      published: data.rows.item(0).published,
      genre: data.rows.item(0).genre,
      length: data.rows.item(0).length,
      language: data.rows.item(0).language,
      translator: data.rows.item(0).translator,
      ISBN: data.rows.item(0).ISBN,
      path: data.rows.item(0).path,
      progress: data.rows.item(0).progress,
      rating: data.rows.item(0).rating,
      img: data.rows.item(0).img,
      serie: data.rows.item(0).serie,
      serieOrder: data.rows.item(0).serieOrder,
      dtbkId: data.rows.item(0).dtbkId,
      lgId: data.rows.item(0).lgId,
      cbdbId: data.rows.item(0).cbdbId,
    };
  }

  public async deleteAuthor(id: number) {
    await this.database.executeSql('DELETE FROM authors WHERE id = ?', [id]);
    this.authors.next(this.authors.getValue().filter(ath => ath.id !== id));
    await this.database.executeSql('DELETE FROM books WHERE creatorId = ?', [id]);
    this.allBooks.next(this.allBooks.getValue().filter(bk => bk.creatorId !== id));
    this.books.next(this.books.getValue().filter(bk => bk.creatorId !== id));
  }

  public async deleteBook(bookId: number, authorId: number) {
    await this.database.executeSql('DELETE FROM books WHERE id = ?', [bookId]);
  }

  public async updateAuthor(author: AUTHOR) {
    const biography = author.biography ? author.biography.replace(/\n/g, '<br>') : null;
    const data = [
      author.name,
      author.surname,
      author.pseudonym,
      author.nationality,
      author.birth,
      author.death,
      biography,
      author.img,
      author.rating,
      author.path,
      author.idInJson,
      author.dtbkId,
      author.lgId,
      author.cbdbId,
    ];

    await this.database.executeSql(
      `UPDATE authors SET name = ?,
          surname = ?, pseudonym = ?, nationality = ?, birth = ?, death = ?,
          biography = ?, img = ?, rating = ?, path = ?, idInJson = ?,
          dtbkId = ?, lgId = ?, cbdbId = ? WHERE id = ${author.id}`,
      data
    );
    const simpl = {
      name: author.name,
      surname: author.surname,
      pseudonym: author.pseudonym,
      img: author.img,
      id: author.id,
    };
    const authors = this.authors.getValue().map(ath => {
      if (ath.id === author.id) {
        return simpl;
      } else {
        return ath;
      }
    });
    this.authors.next(authors);
  }

  public async addBook(book: BOOK) {
    const data = [
      book.title,
      book.creatorId,
      book.originalTitle,
      book.annotation,
      book.publisher,
      book.published,
      book.genre,
      book.length,
      book.language,
      book.translator,
      book.ISBN,
      book.path,
      book.progress,
      book.rating,
      book.img,
      book.dtbkId,
      book.lgId,
      book.cbdbId,
    ];
    try {
      const output = await this.database.executeSql(
        `INSERT INTO books (title, creatorId, originalTitle, annotation, publisher, published, genre,
        lenght, language, translator, ISBN, path, progress, rating, img, dtbkId, lgId, cbdbId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data
      );
      const books = this.books.getValue();
      book.id = output.insertId;
      books.push(book);
      this.books.next(books);
    } catch (e) {
      console.error('cannot add a book');
      console.error(e);
    }
  }

  public updateBookProgress(id: number, progress: string) {
    this.database.executeSql(
      'UPDATE books SET progress = ? WHERE id = ?',
      [progress, id]
    ).then(() => {
      this.allBooks.getValue().map((item) => {
        if (item.id === id) {
          return this.getBook(id);
        }
        return item;
      });
    }).catch(e => {
      console.error('updateBookProgress failed');
      throw new Error(JSON.stringify(e));
    });
  }

  public async updateBook(book: BOOK) {
    const data = [
      book.title,
      book.originalTitle,
      book.annotation,
      book.publisher,
      book.published,
      book.genre,
      book.length,
      book.language,
      book.translator,
      book.ISBN,
      book.path,
      book.progress,
      book.rating,
      book.img,
      book.serie,
      book.serieOrder,
      book.dtbkId,
      book.lgId,
      book.cbdbId,
    ];
    await this.database.executeSql(
      `UPDATE books SET title = ?,
          originalTitle = ?,
          annotation = ?,
          publisher = ?,
          published = ?,
          genre = ?,
          lenght = ?,
          language = ?,
          translator = ?,
          ISBN = ?,
          path = ?,
          progress = ?,
          rating = ?,
          img = ?,
          serie = ?,
          serieOrder = ?,
          dtbkId = ?,
          lgId = ?,
          cbdbId = ?
          WHERE id = ${book.id}`,
      data
    );
    const allBooks = this.allBooks.getValue();
    const indexAllBooks = allBooks.findIndex(bk => bk.id === book.id);
    if (indexAllBooks !== -1) {
      allBooks[indexAllBooks] = book;
      this.allBooks.next(allBooks);
    }
    const books = this.books.getValue();
    const index = books.findIndex(bk => bk.id === book.id);
    if (index !== -1) {
      books[index] = book;
      this.books.next(books);
    }
  }

  public async allAuthorsPaths(): Promise<string[]> {
    const data = await this.database.executeSql('SELECT path FROM authors', []).catch(e => {
      console.error('allAuthorsPaths select failed.');
      throw new Error(JSON.stringify(e));
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
      'SELECT path FROM books WHERE creatorId = ?',
      [authorId]
    ).catch(e => {
      console.error('authorsBooksPaths failed!');
      throw new Error(JSON.stringify(e));
    });
    const paths = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        paths.push(data.rows.item(i).path);
      }
    }
    return paths;
  }

  public async loadBooks(type: 'liked' | 'started' | 'finished'): Promise<void> {
    let books = [];
    if (type === 'liked') {
      books = await this.getLikedBooks();
    } else if (type === 'started') {
      books = await this.getStartedBooks();
    } else if (type === 'finished') {
      books = await this.getFinishedBooks();
    }
    this.allBooks.next(books);
  }

  public async getStartedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorId: number,
  }[]> {
    const data = await this.database.executeSql(
      'SELECT id, title, progress, img, creatorId FROM books WHERE progress LIKE "%/%" ORDER BY title COLLATE NOCASE ASC',
      []
    ).catch((e) => {
      console.error('getStartedBooks failed!');
      throw new Error(JSON.stringify(e));
    });

    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getFinishedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorId: number,
  }[]> {
    const data = await this.database.executeSql(
      'SELECT id, title, progress, img, creatorId FROM books WHERE progress == "finished" ORDER BY title COLLATE NOCASE ASC',
      []
    ).catch((e) => {
      console.error('getFinishedBooks failed!');
      throw new Error(JSON.stringify(e));
    });
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getLikedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorId: number,
  }[]> {
    const data = await this.database.executeSql(
      'SELECT id, title, progress, img, creatorId FROM books WHERE rating > 2 ORDER BY title COLLATE NOCASE ASC',
      []
    ).catch((e) => {
      console.error('getLikedBooks failed!');
      throw new Error(JSON.stringify(e));
    });
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  private getReducedBooksFromSqlRows(rows: any): {
    id: number,
    title: string,
    progress: string,
    img: string,
    creatorId: number,
  }[] {
    const books = [];
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        books.push({
          id: rows.item(i).id,
          title: rows.item(i).title,
          progress: rows.item(i).progress,
          img: rows.item(i).img,
          creatorId: rows.item(i).creatorId
        });
      }
    }
    return books;
  }

  public saveValue(name: string, value: any) {
    this.storage.set(name, value).catch((e) => {
      console.error(`saveValue failed! name: ${name}, value: ${value}`);
      throw new Error(JSON.stringify(e));
    });
  }

  public getValue(name: string): Promise<any> {
    return this.storage.get(name).catch((e) => {
      console.error(`getValue failed! name: ${name}`);
      throw new Error(JSON.stringify(e));
    });
  }

  public async getVersion() {
    const data = await this.database.executeSql(
      'SELECT version FROM dbInfo',
      []
    ).catch((e) => {
      console.error('getVersion failed!');
      throw new Error(JSON.stringify(e));
    });
    return data.rows.item(0).version;
  }
}
