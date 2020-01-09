import { Platform } from '@ionic/angular';
import { Injectable } from '@angular/core';
import { SQLitePorter } from '@ionic-native/sqlite-porter/ngx';
import { HttpClient } from '@angular/common/http';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite/ngx';
import { BehaviorSubject, Observable } from 'rxjs';
import { Storage } from '@ionic/storage'

export interface Author {
  id: number;
  name: string;
  surname: string;
  nationality: string;
  birth: number;
  death: number;
  biography: string;
  img: string;
  rating: number;
  path: string;
}

export interface Book {
  id: number;
  title: string;
  creatorId: number;
  originalTitle: string;
  annotation: string;
  publisher: string;
  published: number;
  genre: string;
  length: number;
  language: string;
  translator: string;
  ISBN: string;
  path: string;
  progress: string;
  rating: number;
}


@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private database: SQLiteObject;
  private dbReady: BehaviorSubject<boolean> = new BehaviorSubject(false);

  authors = new BehaviorSubject([]);
  books = new BehaviorSubject([]);

  constructor(private plt: Platform,
              private sqlitePorter: SQLitePorter,
              private sqlite: SQLite,
              private http: HttpClient,
              private storage: Storage) {

    this.plt.ready().then(() => {
      this.sqlite.create({
        name: 'authors.db',
        location: 'default'
      }).then((db: SQLiteObject) => {
        this.database = db;
        this.seedDatabase();
      }).catch(e => {
        console.log('sqlite.create failed: ');
        console.log(e);
      });
    }).catch(e => {
      console.log('db service plt.ready failed: ');
      console.log(e);
    });
  }

  seedDatabase() {
    this.http.get('assets/seed.sql', { responseType: 'text'})
    .subscribe(sql => {
      this.sqlitePorter.importSqlToDb(this.database, sql)
        .then(_ => {
          this.loadAuthors();
          this.dbReady.next(true);
        })
        .catch(e => console.error(e));
    });
  }

  getDatabaseState() {
    return this.dbReady.asObservable();
  }

  getAuthors(): Observable<Author[]> {
    return this.authors.asObservable();
  }

  getBooks(): Observable<any[]> {
    return this.books.asObservable();
  }

  loadAuthors() {
    return this.database.executeSql('SELECT * FROM authors ORDER BY surname COLLATE NOCASE ASC', []).then(data => {
      const authors: Author[] = [];

      if (data.rows.length > 0) {
        for (let i = 0; i < data.rows.length; i++) {
            authors.push({
            id: data.rows.item(i).id,
            name: data.rows.item(i).name,
            surname: data.rows.item(i).surname,
            nationality: data.rows.item(i).nationality,
            birth: data.rows.item(i).birth,
            death: data.rows.item(i).death,
            biography: data.rows.item(i).biography,
            img: data.rows.item(i).img,
            rating: data.rows.item(i).rating,
            path: data.rows.item(i).path
           });
        }
      }
      this.authors.next(authors);
    }).catch(e => {
      console.log('loadAuthors failed: ');
      console.log(e);
    });
  }

  addAuthor(author: Author): Promise<number> {
    const data = [author.name, author.surname, author.nationality, author.birth, author.death,
                  author.biography, author.img, author.rating, author.path];
    return this.database.executeSql(`INSERT INTO authors
     (name, surname, nationality, birth, death, biography, img, rating, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, data).then(
      output => {
        author.id = output.insertId;
        const athrs = this.authors.getValue();
        athrs.push(author);
        this.authors.next(athrs);
        return output.insertId;
      }
    );
  }

  getAuthor(id: number): Promise<Author> {
    return this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]).then(data => {

      return {
        id: data.rows.item(0).id,
        name: data.rows.item(0).name,
        surname: data.rows.item(0).surname,
        nationality: data.rows.item(0).nationality,
        birth: data.rows.item(0).birth,
        death: data.rows.item(0).death,
        biography: data.rows.item(0).biography ? data.rows.item(0).biography.replace(/<br>/g, '\n') : data.rows.item(0).biography,
        img: data.rows.item(0).img,
        rating: data.rows.item(0).rating,
        path: data.rows.item(0).path
      };
    });
  }

  getBooksOfAuthor(id: number): Promise<void> {
    return this.database.executeSql('SELECT * FROM books WHERE creatorId = ? ORDER BY title ASC', [id]).then(data => {
      const books: Book[] = [];

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
            rating: data.rows.item(i).rating
          });
        }
      }
      this.books.next(books);
    });
  }

  getBook(id: number): Promise<Book> {
    return this.database.executeSql('SELECT * FROM books WHERE id = ?', [id]).then(data => {

      return {
        id:  data.rows.item(0).id,
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
        rating: data.rows.item(0).rating
      };
    });
  }

  deleteAuthor(id: number) {
    return this.database.executeSql('DELETE FROM authors WHERE id = ?', [id]).then(_ => {
      this.loadAuthors();
    });
  }

  updateAuthor(author: Author) {
    const biography = author.biography ? author.biography.replace(/\n/g, '<br>') : null;
    const data = [author.name, author.surname, author.nationality, author.birth,
                  author.death, biography, author.img, author.rating, author.path];
    return this.database.executeSql(`UPDATE authors SET name = ?,
     surname = ?, nationality = ?, birth = ?, death = ?,
     biography = ?, img = ?, rating = ?, path = ? WHERE id = ${author.id}`, data).then(_ => {
      this.loadAuthors();
    });
  }

  loadBooks(id: number) {
    return this.database.executeSql('SELECT * FROM authors WHERE id = ?', [id]).then(data => {
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
            rating: data.rows.item(i).rating
           });
        }
      }
      this.books.next(books);
    });
  }

  addBook(book: Book) {
    const data = [book.title, book.creatorId, book.originalTitle, book.annotation, book.publisher, book.published,
      book.genre, book.length, book.language, book.translator, book.ISBN, book.path, book.progress, book.rating];
    return this.database.executeSql(
      `INSERT INTO books (title, creatorId, originalTitle, annotation, publisher, published, genre,
        lenght, language, translator, ISBN, path, progress, rating)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, data).then(
      output => {
        const books = this.books.getValue();
        book.id = output.insertId;
        books.push(book);
        this.books.next(books);
      }).catch(e => {
        console.log('cannot add a book');
        console.log(e);
      });
  }

  checkIfAuthorExists(name: string, surname: string): Promise<boolean> {
    return this.database.executeSql('SELECT * FROM authors WHERE name = ? AND surname = ?', [name, surname]).then(
      data => {
        if (data.rows.length === 0) {
          return false;
        } else {
          return true;
        }
      }
    );
  }

  addBookIfNotExists(name: string, authorId: number, pth: string) {
    this.database.executeSql('SELECT * FROM books WHERE title = ? AND creatorId = ?', [name, authorId]).then(
      data => {
        if (data.rows.length === 0) {
          this.addBook({id: null,
                        title: name,
                        creatorId: authorId,
                        originalTitle: null,
                        annotation: null,
                        publisher: null,
                        published: null,
                        genre: null,
                        length: null,
                        language: null,
                        translator: null,
                        ISBN: null,
                        path: pth,
                        progress: null,
                        rating: null
          });
        }
      });
  }

  updateBookProgress(id: number, progress: string) {
    this.database.executeSql('UPDATE books SET progress = ? WHERE id = ?', [progress, id]);
  }

  updateBook(book: Book) {
    const data = [book.title, book.originalTitle, book.annotation, book.publisher,
                  book.published, book.genre, book.length, book.language,
                  book.translator, book.ISBN, book.path, book.progress, book.rating];
    return this.database.executeSql(`UPDATE books SET title = ?,
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
                                    rating = ?
                                    WHERE id = ${book.id}`, data).then(_ => {
      // this.loadAuthors();
    });
  }


  allAuthorsPaths() {
    return this.database.executeSql('SELECT path FROM authors', []).then(data => {
      const paths = [];
      if (data.rows.length > 0) {
        for (let i = 0; i < data.rows.length; i++) {
          paths.push(data.rows.item(i).path);
        }
      }
      return paths;
    });
  }

  authorsBooksPaths(authorId: number) {
    return this.database.executeSql('SELECT path FROM books WHERE creatorId = ?', [authorId]).then(data => {
      const paths = [];
      if (data.rows.length > 0) {
        for (let i = 0; i < data.rows.length; i++) {
          paths.push(data.rows.item(i).path);
        }
      }
      return paths;
    });
  }

  saveValue(name: string, value: any) {
    this.storage.set(name, value);
  }

  getValue(name: string) {
    return this.storage.get(name);
  }
}
