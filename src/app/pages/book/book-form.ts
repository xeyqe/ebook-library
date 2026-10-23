import { FormControl, FormGroup } from '@angular/forms';
import { BOOK } from 'src/app/services/interfaces';
export const BOOK_FIELDS = [
  'img',
  'title',
  'originalTitle',
  'genre',
  'ISBN',
  'publisher',
  'published',
  'language',
  'translator',
  'length',
  'progress',
  'rating',
  'annotation',
  'serie',
  'serieOrder',
  'lgId',
  'dtbkId',
  'cbdbId',
  'added',
  'lastRead',
  'finished',
] as const satisfies readonly (keyof BOOK)[];
export const BOOK_METADATA_FIELDS = [
  'img',
  'title',
  'originalTitle',
  'genre',
  'publisher',
  'published',
  'annotation',
  'language',
  'translator',
  'ISBN',
  'length',
  'serie',
  'serieOrder',
] as const satisfies readonly BookField[];
export const CBDB_FIELDS = [
  'serie',
  'serieOrder',
  'genre',
  'ISBN',
  'length',
  'img',
  'originalTitle',
  'annotation',
  'publisher',
  'published',
  'cbdbId',
] as const satisfies readonly BookField[];
export type BookField = (typeof BOOK_FIELDS)[number];
export type BookValues = Pick<BOOK, BookField>;
export type BookControls = { [Key in BookField]: FormControl<BookValues[Key]> };
export type BookForm = FormGroup<BookControls>;
export type BookSuggestions = { [Key in BookField]: BookValues[Key][] };
export type BookData = Partial<Record<BookField, string | number | Date>>;
export interface BookDataSelection {
  data: BookData;
  fields?: readonly BookField[];
  clearMissing?: boolean;
  images?: string[];
}
export function createBookForm(): BookForm {
  return new FormGroup<BookControls>({
    img: new FormControl<string>({ value: null, disabled: true }),
    title: new FormControl<string>({ value: null, disabled: true }),
    originalTitle: new FormControl<string>({ value: null, disabled: true }),
    genre: new FormControl<string>({ value: null, disabled: true }),
    ISBN: new FormControl<string>({ value: null, disabled: true }),
    publisher: new FormControl<string>({ value: null, disabled: true }),
    published: new FormControl<number>({ value: null, disabled: true }),
    language: new FormControl<string>({ value: null, disabled: true }),
    translator: new FormControl<string>({ value: null, disabled: true }),
    length: new FormControl<number>({ value: null, disabled: true }),
    progress: new FormControl<string>({ value: null, disabled: true }),
    rating: new FormControl<number>({ value: null, disabled: true }),
    annotation: new FormControl<string>({ value: null, disabled: true }),
    serie: new FormControl<string>({ value: null, disabled: true }),
    serieOrder: new FormControl<number>({ value: null, disabled: true }),
    lgId: new FormControl<string>(null),
    dtbkId: new FormControl<string>(null),
    cbdbId: new FormControl<string>(null),
    added: new FormControl<Date>(null),
    lastRead: new FormControl<Date>(null),
    finished: new FormControl<Date>(null),
  });
}
export function createBookSuggestions(): BookSuggestions {
  return Object.fromEntries(BOOK_FIELDS.map((key) => [key, []])) as BookSuggestions;
}
export function bookFormValues(book: BOOK): BookValues {
  const values = Object.fromEntries(BOOK_FIELDS.map((key) => [key, book[key] ?? null])) as BookValues;
  if (!book.progress) values.progress = '0%';
  else if (book.progress.includes('/')) {
    const [position, total] = book.progress.split('/').map(Number);
    values.progress = `${total > 0 ? Math.floor((position / total) * 100) : 0}%`;
  }
  for (const key of ['added', 'lastRead', 'finished'] as const) values[key] = book[key] ? new Date(book[key]) : null;
  return values;
}
