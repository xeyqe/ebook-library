import { Injectable } from '@angular/core';
import { Encoding, Filesystem } from '@capacitor/filesystem';

import { DirectoryService } from './directory.service';
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
    private dir: DirectoryService,
  ) { }

  public async jsonAuthorsIndexesData(): Promise<boolean> {
    return Filesystem.readFile({
      path: 'ebook-library/authorsIndexes.json',
      directory: this.dir.dir,
      encoding: Encoding.UTF8,
    }).then((data) => {
      this.authorsIndexes = JSON.parse(data.data);
      return true;
    }).catch(() => {
      return false;
    });
  }

  public async jsonAuthorsData(): Promise<boolean> {
    return Filesystem.readFile({
      path: 'ebook-library/authors.json',
      directory: this.dir.dir,
      encoding: Encoding.UTF8,
    }).then(data => {
      this.author = JSON.parse(data.data);
      return true;
    }).catch(e => {
      return false;
    });
  }

  // async jsonBooksIndexesData(): Promise<boolean> {
  //   const path = this.file.externalRootDirectory + 'ebook-library/';
  //   const data = await this.file.readAsText(path, 'booksIndexes.json');
  //   this.booksIndexes = JSON.parse(data);
  //   return true;
  // }

  public async jsonBooksData(): Promise<boolean> {
    return Filesystem.readFile({
      path: 'ebook-library/books.json',
      directory: this.dir.dir,
      encoding: Encoding.UTF8,
    }).then(data => {
      this.book = JSON.parse(data.data);
      return true;
    }).catch(e => {
      return false;
    });
  }

  public getListOfAuthors(): INDEXOFAUTHOR[] {
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

  public getAuthor(index: string): AUTHORJSON {
    if (this.author) {
      return this.author[index];
    }
  }

  public getBook(index: string): BOOKJSON {
    if (this.book) {
      return this.book[index];
    }
  }
}
