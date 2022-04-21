import { Pipe, PipeTransform } from '@angular/core';

import { AUTHORSIMPLIFIED, BOOKSIMPLIFIED } from '../services/interfaces';


@Pipe({
  name: 'filter',
})
export class FilterPipe implements PipeTransform {
  transform(value: any, filterString: string, character: string, what2search: string): AUTHORSIMPLIFIED | BOOKSIMPLIFIED {
    if (what2search === 'book') {
      if (filterString && filterString.length) {
        if (filterString.length < 3) {
          return value
          .filter((item: BOOKSIMPLIFIED) => {
            if (item.title.substring(0, filterString.length).toLowerCase() === filterString.toLocaleLowerCase()) {
              return item;
            }
          });
        } else {
          return value
            .filter((item: BOOKSIMPLIFIED) => {
              if (item.title.toLowerCase().includes(filterString.toLocaleLowerCase())) {
                return item;
              }
            })
            .sort((a: BOOKSIMPLIFIED, b: BOOKSIMPLIFIED) => a.title.localeCompare(b.title, 'cs'));
        }
      } else {
        if (character === 'started') {
          return value.filter((item: BOOKSIMPLIFIED) => {
            if (item.progress && item.progress.includes('/')) {
              return item;
            }
          });
        } else if (character === 'finished') {
          return value.filter((item: BOOKSIMPLIFIED) => {
            if (item.progress && item.progress === 'finished') {
              return item;
            }
          });
        } else {
          return value.filter((item: BOOKSIMPLIFIED) => {
            if (item.rating && item.rating > 3) {
              return item;
            }
          });
        }
      }
    } else {
      const hacky = {
        Z: 'Ž', S: 'Š', C: 'Č', R: 'Ř', D: 'Ď', T: 'Ť', N: 'Ň',
      };

      const alphabet = {
        A: true, B: true, C: true, Č: true, D: true, Ď: true, E: true, F: true, G: true, H: true,
        I: true, J: true, K: true, L: true, M: true, N: true, Ň: true, O: true, P: true, Q: true,
        R: true, Ř: true, S: true, Š: true, T: true, Ť: true, U: true, V: true, W: true, X: true,
        Y: true, Z: true, Ž: true,
      };

      const iHacky = hacky[character];

      if (value.length === 0) {
        return value;
      }
      if (filterString === '') {
        return value
          .filter((item: AUTHORSIMPLIFIED) => {
            if (
              item.surname &&
              (item.surname[0].toUpperCase() === character ||
                (iHacky && item.surname[0] === iHacky) ||
                (character === '#' && !alphabet[item.surname[0].toUpperCase()]))
            ) {
              return item;
            }
          })
          .sort((a, b) => a.surname.localeCompare(b.surname, 'cs'));
      } else if (filterString.length < 3) {
        return value.filter((item: AUTHORSIMPLIFIED) => {
          if (
            // item.name.toLowerCase().includes(filterString.toLowerCase()) ||
            item.surname &&
            item.surname.substring(0, filterString.length).toLowerCase() === filterString.toLowerCase()
          ) {
            return item;
          }
        });
      } else {
        return value.filter((item: AUTHORSIMPLIFIED) => {
          if (
            (item.name && item.name.toLowerCase().includes(filterString.toLowerCase())) ||
            (item.surname && item.surname.toLowerCase().includes(filterString.toLowerCase()))
          ) {
            return item;
          }
        });
      }
    }
  }
}
