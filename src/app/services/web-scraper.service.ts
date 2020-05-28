import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class WebScraperService {
  showable = false;

  constructor(

  ) { }

  getAuthor(url: string): Promise<any> {
    return new Promise((resolve) => resolve({name: null, surname: null, nationality: null, birth: null, death: null, biography: null}));
  }

  getBooksList(authorName: string): Promise<any> {
    return new Promise((resolve) => resolve({
      
    }));
  }

  getAuthorsList(authorName: string): Promise<any> {
    return new Promise((resolve) => resolve({
      
    }));
  }

  getBook(url: string): Promise<any> {
    return new Promise((resolve) => resolve({
      img: null, title: null, originalTitle: null, genre: null, publisher: null,
      published: null, annotation: null, isbn: null, language: null, translator: null,
      pages: null
    }));
  }
}
