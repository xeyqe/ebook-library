import { Injectable } from '@angular/core';
import { ONLINEAUTHORLEGIE, ONLINEBOOKLINK } from 'src/app/services/interfaces';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private _onlineData: {
    [authorId: string]: {
      onlineAllBooksList: ONLINEBOOKLINK[];
      onlineBookListLegie: ONLINEAUTHORLEGIE[];
      onlineShortStoriesListLegie: { title: string; link: string; lgId: string; review: string; }[];
    };
  };

  public get onlineData(): {
    [authorId: string]: {
      onlineAllBooksList: ONLINEBOOKLINK[];
      onlineBookListLegie: ONLINEAUTHORLEGIE[];
      onlineShortStoriesListLegie: { title: string; link: string; lgId: string; review: string; }[];
    };
  } {
    return this._onlineData;
  }
  public set onlineData(value: {
    [authorId: string]: {
      onlineAllBooksList: ONLINEBOOKLINK[];
      onlineBookListLegie: ONLINEAUTHORLEGIE[];
      onlineShortStoriesListLegie: { title: string; link: string; lgId: string; review: string; }[];
    };
  }) {
    this._onlineData = value;
  }
}
