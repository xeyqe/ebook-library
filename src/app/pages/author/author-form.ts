import { FormControl, FormGroup } from '@angular/forms';
import { AUTHOR } from 'src/app/services/interfaces';

export const AUTHOR_FIELDS = [
  'img',
  'name',
  'surname',
  'pseudonym',
  'nationality',
  'birth',
  'death',
  'biography',
  'idInJson',
  'dtbkId',
  'lgId',
  'cbdbId',
] as const satisfies readonly (keyof AUTHOR)[];

export type AuthorField = (typeof AUTHOR_FIELDS)[number];
export type AuthorValues = Pick<AUTHOR, AuthorField>;
export type AuthorControls = { [Key in AuthorField]: FormControl<AuthorValues[Key]> };
export type AuthorSuggestions = { [Key in AuthorField]: AuthorValues[Key][] };
export type AuthorData = Partial<Record<AuthorField, string | number>>;

export type AuthorForm = FormGroup<AuthorControls>;
export interface AuthorDataSelection {
  data: AuthorData;
  fields?: readonly AuthorField[];
}

export function createAuthorForm(): AuthorForm {
  return new FormGroup<AuthorControls>({
    img: new FormControl<string>({ value: null, disabled: true }),
    name: new FormControl<string>({ value: null, disabled: true }),
    surname: new FormControl<string>({ value: null, disabled: true }),
    pseudonym: new FormControl<string>({ value: null, disabled: true }),
    nationality: new FormControl<string>({ value: null, disabled: true }),
    birth: new FormControl<number>({ value: null, disabled: true }),
    death: new FormControl<number>({ value: null, disabled: true }),
    biography: new FormControl<string>({ value: null, disabled: true }),
    idInJson: new FormControl<string>(null),
    dtbkId: new FormControl<string>(null),
    lgId: new FormControl<string>(null),
    cbdbId: new FormControl<string>(null),
  });
}

export function createAuthorSuggestions(): AuthorSuggestions {
  return {
    img: [],
    name: [],
    surname: [],
    pseudonym: [],
    nationality: [],
    birth: [],
    death: [],
    biography: [],
    idInJson: [],
    dtbkId: [],
    lgId: [],
    cbdbId: [],
  };
}
