import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';

import { Platform } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite/ngx';

import { AUTHOR, BOOK, AUTHORSIMPLIFIED, BOOKSIMPLIFIED } from 'src/app/services/interfaces.service';


@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);

  authors = new BehaviorSubject<AUTHORSIMPLIFIED[]>([]);
  books = new BehaviorSubject([]);
  allBooks = new BehaviorSubject<BOOKSIMPLIFIED[]>([]);

  constructor(
    private plt: Platform,
    private sqlitePorter: SQLitePorter,
    private sqlite: SQLite,
    private http: HttpClient,
    private storage: Storage
  ) {
    this.plt
      .ready()
      .then(() => {
        this.sqlite
          .create({
            name: 'authors.db',
            location: 'default',
          })
          .then((db: SQLiteObject) => {
            this.database = db;
            this.seedDatabase();
          })
          .catch((e) => {
            console.error('sqlite.create failed: ');
            console.error(e);
          });
      })
      .catch((e) => {
        console.error('db service plt.ready failed: ');
        console.error(e);
      });
  }

  seedDatabase() {
    this.http.get('assets/seed.sql', { responseType: 'text' }).subscribe((sql) => {
      this.sqlitePorter
        .importSqlToDb(this.database, sql)
        .then((_) => {
          this.loadAuthors();
          this.dbReady.next(true);
        })
        .catch((e) => console.error(e));
    });
  }

  public exportDB(): Promise<any> {
    return this.sqlitePorter.exportDbToJson(this.database);
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

  async loadAuthors() {
    try {
      const data = await this.database
        .executeSql('SELECT * FROM authors ORDER BY surname COLLATE NOCASE ASC', []);
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
      this.authors.next(authors);
    }
    catch (e) {
      console.error('loadAuthors failed: ');
      console.error(e);
    }
  }

  async addAuthor(author: AUTHOR): Promise<number> {
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
    const output = await this.database
      .executeSql(
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
    const _ = await this.database.executeSql('DELETE FROM authors WHERE id = ?', [id]);
    this.database.executeSql('DELETE FROM books WHERE creatorId = ?', [id]).then(() => {
      this.loadAuthors();
    });
  }

  async deleteBook(bookId: number, authorId: number) {
    const _ = await this.database.executeSql('DELETE FROM books WHERE id = ?', [bookId]);
    this.loadBooks(authorId);
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
    const _ = await this.database
      .executeSql(
        `UPDATE authors SET name = ?,
          surname = ?, nationality = ?, birth = ?, death = ?,
          biography = ?, img = ?, rating = ?, path = ?, idInJson = ? WHERE id = ${author.id}`,
        data
      );
    this.loadAuthors();
  }

  async loadBooks(id: number) {
    const data = await this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]);
    const books = [];
    if (data.rows.length > 0) {
      for (let i = 0; i < data.rows.length; i++) {
        books.push({
          title: data.rows.item(i).title,
          creatorId: data.rows.item(i).creatorId,
          originalTitle: data.rows.item(i).originalTitle,
          annotation: data.rows.item(i).annotation,
          publisher: data.rows.item(i).publisher,
          published: data.rows.item(i).published,
          genre: data.rows.item(i).genre,
          lenght: data.rows.item(i).lenght,
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
      const output = await this.database
        .executeSql(
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
    const data = await this.database
      .executeSql('SELECT * FROM authors WHERE name = ? AND surname = ?', [name, surname]);
    if (data.rows.length === 0) {
      return false;
    }
    else {
      return true;
    }
  }

  updateBookProgress(id: number, progress: string) {
    this.database.executeSql('UPDATE books SET progress = ? WHERE id = ?', [progress, id]).then((_) => {
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
    const _ = await this.database
      .executeSql(
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

  async getStartedBooks(): Promise<BOOK[]> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE progress LIKE "%/%"', []);
    return data;
  }

  async getFinishedBooks(): Promise<BOOK[]> {
    const data = await this.database.executeSql('SELECT * FROM books WHERE progress == "finished"', []);
    return data;
  }

  saveValue(name: string, value: any) {
    this.storage.set(name, value);
  }

  getValue(name: string): Promise<any> {
    return this.storage.get(name);
  }
}
