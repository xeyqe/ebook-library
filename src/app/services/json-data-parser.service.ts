import { Injectable } from '@angular/core';
import { File } from '@ionic-native/file/ngx';
import { BOOKJSON, INDEXOFAUTHOR, AUTHORJSON } from './interfaces.service';

@Injectable({
  providedIn: 'root',
})
export class JsonDataParserService {
  authorsIndexes: INDEXOFAUTHOR[];
  author: AUTHORJSON;
  book: BOOKJSON;
  // booksIndexes;

  constructor(
    private file: File
  ) { }

  async jsonAuthorsIndexesData(): Promise<boolean> {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    try {
      return this.file.checkFile(path, 'authorsIndexes.json').then(async (exists) => {
        if (exists) {
          const data = await this.file.readAsText(path, 'authorsIndexes.json');
          this.authorsIndexes = JSON.parse(data);
          return true;
        }
        return false;
      });
    } catch (e) {
      console.error('jsonAuthorsIndexesData failed');
      console.error(e);
    }
  }

  async jsonAuthorsData(): Promise<boolean> {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    const data = await this.file.readAsText(path, 'authors.json');
    this.author = JSON.parse(data);
    return true;
  }

  // async jsonBooksIndexesData(): Promise<boolean> {
  //   const path = this.file.externalRootDirectory + 'ebook-library/';
  //   const data = await this.file.readAsText(path, 'booksIndexes.json');
  //   this.booksIndexes = JSON.parse(data);
  //   return true;
  // }

  async jsonBooksData(): Promise<boolean> {
    const path = this.file.externalRootDirectory + 'ebook-library/';
    const data = await this.file.readAsText(path, 'books.json');
    this.book = JSON.parse(data);
    return true;
  }

  getListOfAuthors(): INDEXOFAUTHOR[] {
    if (this.authorsIndexes) {
      return this.authorsIndexes;
    }
  }

  // getAuthors() {
  //   if (this.authors) {
  //     return this.authors;
  //   }
  // }

  // getListOfBooks() {
  //   if (this.booksIndexes) {
  //     return this.booksIndexes;
  //   }
  // }

  getAuthor(index: string): AUTHORJSON {
    if (this.author) {
      return this.author[index];
    }
  }

  getBook(index: string): BOOKJSON {
    if (this.book) {
      return this.book[index];
    }
  }
}
