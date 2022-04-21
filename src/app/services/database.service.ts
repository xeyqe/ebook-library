import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { Platform } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite/ngx';

import { AUTHOR, BOOK, AUTHORSIMPLIFIED, BOOKSIMPLIFIED } from 'src/app/services/interfaces.service';
import { FileReaderService } from './file-reader.service';


@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private version = 1;

  authors = new BehaviorSubject<AUTHORSIMPLIFIED[]>([]);
  books = new BehaviorSubject([]);
  allBooks = new BehaviorSubject<BOOKSIMPLIFIED[]>([]);

  constructor(
    private fr: FileReaderService,
    private http: HttpClient,
    private plt: Platform,
    private sqlitePorter: SQLitePorter,
    private sqlite: SQLite,
    private storage: Storage,
  ) {
    this.plt.ready().then(() => {
      this.storage.create().then(() => {
        this.sqlite.create({
          name: 'authors.db',
          location: 'default',
        }).then((db: SQLiteObject) => {
          this.database = db;
          this.seedDatabase();
        }).catch((e) => {
          console.error('sqlite.create failed: ');
          console.error(e);
        });
      });
    }).catch((e) => {
      console.error('db service plt.ready failed: ');
      console.error(e);
    });
  }

  seedDatabase() {
    this.http.get('assets/seed.sql', { responseType: 'text' }).subscribe({
      next: async (sql) => {
        try {
          await this.database.executeSql(
            'SELECT id FROM authors LIMIT 1',
            []
          );
          this.takeCareOfUpdateDB();
        } catch (e) { }
        this.sqlitePorter.importSqlToDb(this.database, sql).then(async () => {
          this.dbReady.next(true);
        }).catch((e) => console.error(e));
      },
      error: error => {
        console.error(error);
      }
    });
  }

  private async takeCareOfUpdateDB() {
    try {
      const data = await this.database.executeSql(
        'SELECT version FROM dbInfo',
        []
      );
      if (data.rows.item(0).version !== this.version) {
        await this.setVersion(this.version);
      }
    } catch (e) {
      await this.setVersion(1);
    }
  }

  private async setVersion(version: number) {
    console.error('SETVERSION launched ' + version)
    const json = await this.exportDB();
    await this.fr.write2File(JSON.stringify(json));
    if (version === 1) {
      await this.database.executeSql(
        'CREATE TABLE IF NOT EXISTS dbInfo (version INTEGER PRIMARY KEY)', []
      );

      await this.database.executeSql(
        'INSERT INTO dbInfo (version) VALUES (1)', []
      );
      await this.updateDB0To1();
    } else {
      await this.database.executeSql(
        'UPDATE dbInfo SET version = ?',
        [version]
      );
    }
  }

  private async updateDB0To1() {
    await this.database.executeSql(
      `UPDATE authors SET img = SUBSTR(img, 47, LENGTH(img) - 46) WHERE img LIKE '%http://localhost/_app_file_/storage/emulated/0%'`, []
    );

    await this.database.executeSql(
      `UPDATE books SET img = SUBSTR(img, 47, LENGTH(img) - 46) WHERE img LIKE '%http://localhost/_app_file_/storage/emulated/0%'`, []
    );
  }

  public exportDB(): Promise<any> {
    return this.sqlitePorter.exportDbToJson(this.database);
  }

  public async importDB(json: string): Promise<any> {
    await this.sqlitePorter.wipeDb(this.database);
    await this.sqlitePorter.importJsonToDb(this.database, json);
    await this.takeCareOfUpdateDB();
  }

  getDatabaseState(): Observable<boolean> {
    return this.dbReady.asObservable();
  }

  getAuthors(): Observable<AUTHORSIMPLIFIED[]> {
    return this.authors.asObservable();
  }

  getBooks(): Observable<BOOK[]> {
    return this.books.asObservable();
  }

  getAllBooks(): Observable<BOOKSIMPLIFIED[]> {
    return this.allBooks.asObservable();
  }

  public async loadAuthors(character: string) {
    try {
      const data = await this.database.executeSql(
        `SELECT id, name, surname, img FROM authors WHERE surname LIKE "${character}%" ORDER BY surname COLLATE NOCASE ASC`,
        []
      );
      const authors = [];

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
      console.error(authors);
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
      author.nationality,
      author.birth,
      author.death,
      author.biography,
      author.img,
      author.rating,
      author.path,
    ];
    const output = await this.database.executeSql(
      `INSERT INTO authors
          (name, surname, nationality, birth, death, biography, img, rating, path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data
    );
    author.id = output.insertId;
    const athrs = this.authors.getValue();
    athrs.push({ name: author.name, surname: author.surname, img: author.img, id: author.id });
    this.authors.next(athrs);
    return output.insertId;
  }

  async getAuthor(id: number): Promise<AUTHOR> {
    const data = await this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]);
    return {
      id: data.rows.item(0).id,
      name: data.rows.item(0).name,
      surname: data.rows.item(0).surname,
      nationality: data.rows.item(0).nationality,
      birth: data.rows.item(0).birth,
      death: data.rows.item(0).death,
      biography: data.rows.item(0).biography
        ? data.rows.item(0).biography.replace(/<br>/g, '\n')
        : data.rows.item(0).biography,
      img: data.rows.item(0).img,
      rating: data.rows.item(0).rating,
      path: data.rows.item(0).path,
      idInJson: data.rows.item(0).idInJson,
    };
  }

  async getBooksOfAuthor(id: number): Promise<any> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE creatorId = ? ORDER BY title ASC', [id]);
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
        });
      }
    }
    this.books.next(books);
  }

  async getBook(id: number): Promise<BOOK> {
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
    };
  }

  async getAllBooksDb() {
    const data = await this.database.executeSql('SELECT * FROM books');
    const books = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        books.push({
          id: data.rows(i).id,
          title: data.rows.item(i).title,
          progress: data.rows.item(i).progress,
          rating: data.rows.item(i).rating,
          img: data.rows.item(i).img,
        });
      }
    }
    this.allBooks.next(books);
  }

  async deleteAuthor(id: number) {
    await this.database.executeSql('DELETE FROM authors WHERE id = ?', [id]);
    await this.database.executeSql('DELETE FROM books WHERE creatorId = ?', [id]);
  }

  async deleteBook(bookId: number, authorId: number) {
    await this.database.executeSql('DELETE FROM books WHERE id = ?', [bookId]);
  }

  async updateAuthor(author: AUTHOR) {
    const biography = author.biography ? author.biography.replace(/\n/g, '<br>') : null;
    const data = [
      author.name,
      author.surname,
      author.nationality,
      author.birth,
      author.death,
      biography,
      author.img,
      author.rating,
      author.path,
      author.idInJson,
    ];
    await this.database.executeSql(
      `UPDATE authors SET name = ?,
          surname = ?, nationality = ?, birth = ?, death = ?,
          biography = ?, img = ?, rating = ?, path = ?, idInJson = ? WHERE id = ${author.id}`,
      data
    );
  }

  async loadAllBooks() {
    const data = await this.database.executeSql('SELECT * FROM books ORDER BY title COLLATE NOCASE ASC', []);
    const books = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        books.push({
          id: data.rows.item(i).id,
          title: data.rows.item(i).title,
          progress: data.rows.item(i).progress,
          rating: data.rows.item(i).rating,
          img: data.rows.item(i).img,
        });
      }
    }
    this.allBooks.next(books);
  }

  async addBook(book: BOOK) {
    console.log(book)
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
    ];
    try {
      const output = await this.database.executeSql(
        `INSERT INTO books (title, creatorId, originalTitle, annotation, publisher, published, genre,
        lenght, language, translator, ISBN, path, progress, rating, img)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data
      );
      const books = this.books.getValue();
      book.id = output.insertId;
      books.push(book);
      this.books.next(books);
    }
    catch (e) {
      console.error('cannot add a book');
      console.error(e);
    }
  }

  async checkIfAuthorExists(name: string, surname: string): Promise<boolean> {
    const data = await this.database.executeSql(
      'SELECT * FROM authors WHERE name = ? AND surname = ?',
      [name, surname]
    );
    if (data.rows.length === 0) {
      return false;
    }
    else {
      return true;
    }
  }

  updateBookProgress(id: number, progress: string) {
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
    });
  }

  async updateBook(book: BOOK) {
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
          img = ?
          WHERE id = ${book.id}`,
      data
    );
  }

  async allAuthorsPaths(): Promise<string[]> {
    const data = await this.database.executeSql('SELECT path FROM authors', []);
    const paths = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        paths.push(data.rows.item(i).path);
      }
    }
    return paths;
  }

  async authorsBooksPaths(authorId: number): Promise<string[]> {
    const data = await this.database.executeSql('SELECT path FROM books WHERE creatorId = ?', [authorId]);
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
    this.books.next(books);
  }

  public async getStartedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
  }[]> {
    const data = await this.database.executeSql('SELECT id, title, progress, img FROM books WHERE progress LIKE "%/%" ORDER BY title COLLATE NOCASE ASC', []);
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getFinishedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
  }[]> {
    const data = await this.database.executeSql('SELECT id, title, progress, img FROM books WHERE progress == "finished" ORDER BY title COLLATE NOCASE ASC', []);
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  public async getLikedBooks(): Promise<{
    id: number,
    title: string,
    progress: string,
    img: string,
  }[]> {
    const data = await this.database.executeSql('SELECT id, title, progress, img FROM books WHERE rating > 2 ORDER BY title COLLATE NOCASE ASC', []);
    const books = this.getReducedBooksFromSqlRows(data.rows);
    return books;
  }

  private getReducedBooksFromSqlRows(rows: any): {
    id: number,
    title: string,
    progress: string,
    img: string,
  }[] {
    const books = [];
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i++) {
        books.push({
          id: rows.item(i).id,
          title: rows.item(i).title,
          progress: rows.item(i).progress,
          img: rows.item(i).img,
        });
      }
    }
    return books;
  }

  saveValue(name: string, value: any) {
    this.storage.set(name, value);
  }

  getValue(name: string): Promise<any> {
    return this.storage.get(name);
  }
}
