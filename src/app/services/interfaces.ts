export interface AUTHOR {
  id: number;
  name: string;
  surname: string;
  pseudonym: string;
  nationality: string;
  birth: number;
  death: number;
  biography: string;
  img: string;
  rating: number;
  path: string;
  idInJson: string;
}

export interface BOOK {
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
  serie: string;
  serieOrder: number;
}

export interface BOOKSIMPLIFIED {
  id: number;
  title: string;
  img: string;
  progress: string;
  rating: number;
  creatorId: number;
}

export interface AUTHORSIMPLIFIED {
  name: string;
  surname: string;
  pseudonym: string;
  img: string;
  id: number;
}

export interface METADATA {
  annotation: string;
  ISBN: string;
  author: string;
  genre: string;
  title: string;
  published: number;
  publisher: string;
  imgPath: string;
}

export interface WIKIPEDIADATA {
  ns: number;
  pageid: number;
  size: number;
  snippet: string;
  timestamp: string;
  title: string;
  wordcount: number;
}

export interface ONLINEAUTHORLINK {
  name: string;
  link: string;
  year: number;
  img: string;
}

export interface ONLINEBOOKLINK {
  link: string;
  img: string;
  title: string;
  comment: string;
}

export interface ONLINEBOOK {
  annotation: string;
  genre: string[];
  published: number;
  publisher: string;
  originalTitle: string;
  title: string;
  img: string;
}

export interface ONLINEAUTHOR {
  name: string;
  surname: string;
  nationality: string;
  birth: number;
  death: number;
  biography: string;
  img: string;
}

export interface INDEXOFAUTHOR {
  index: string;
  name: string;
}

export interface INDEXOFBOOK {
  index: string;
  title: string;
}

export interface BOOKJSON {
  annotation: string;
  genre: string;
  img: string;
  BOOKJSON: string;
  language: string;
  originalTitle: string;
  pages: number;
  published: number;
  publisher: string;
  title: string;
  translator: string;
}

export interface AUTHORJSON {
  img: string;
  name: string;
  surname: string;
  birth: number;
  death: number;
  nationality: string;
  biography: string;
  books: INDEXOFBOOK[];
}

export interface CHAPTER {
  id: string;
  src: string;
}
