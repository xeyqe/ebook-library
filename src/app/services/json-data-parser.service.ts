import { Injectable } from '@angular/core';
import { File } from '@ionic-native/file/ngx';

@Injectable({
  providedIn: 'root',
})
export class JsonDataParserService {
  authorsIndexes;
  authors;
  booksIndexes;
  books;

  constructor(private file: File) {}

  jsonAuthorsIndexesData() {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    return this.file
      .readAsText(path, 'authorsIndexes.json')
      .then((data) => {
        this.authorsIndexes = JSON.parse(data);
        return true;
      })
      .catch((e) => {
        console.log(e);
      });
  }

  jsonAuthorsData() {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    return this.file.readAsText(path, 'authors.json').then((data) => {
      this.authors = JSON.parse(data);
      console.log(this.authors[0]);
      return true;
    });
  }

  jsonBooksIndexesData() {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    return this.file.readAsText(path, 'booksIndexes.json').then((data) => {
      this.booksIndexes = JSON.parse(data);
      return true;
    });
  }

  jsonBooksData() {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    return this.file.readAsText(path, 'books.json').then((data) => {
      this.books = JSON.parse(data);
      return true;
    });
  }

  getListOfAuthors() {
    if (this.authorsIndexes) {
      return this.authorsIndexes;
    }
  }

  getAuthors() {
    if (this.authors) {
      return this.authors;
    }
  }

  getListOfBooks() {
    if (this.booksIndexes) {
      return this.booksIndexes;
    }
  }

  getAuthor(index: string) {
    if (this.authors) {
      return this.authors[index];
    }
  }

  getBook(index: string) {
    if (this.books) {
      return this.books[index];
    }
  }
}
