import { Injectable } from '@angular/core';

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
  idInJson: string;
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
  img: string;
}

export interface Metadata {
  annotation: string;
  isbn: string;
  author: string;
  genre: string[];
  title: string;
  published: number;
  publisher: string;
  imgPath: string;
}

@Injectable({
  providedIn: 'root'
})
export class InterfacesService {

  constructor() { }
}
