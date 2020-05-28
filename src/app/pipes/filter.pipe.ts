import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})

export class FilterPipe implements PipeTransform {

  transform(value: any, filterString: string, character: string, what2search: string): any {
    if (what2search === 'book') {
      if (filterString && filterString.length) {
        return value.filter(item => {
          if (item.title.toLowerCase().includes(filterString.toLocaleLowerCase())) {
            return item;
          }
        }).sort((a, b) => a.title.localeCompare(b.title, 'cs'));
      } else {
        return value.filter(item => {
          if (item.rating && item.rating > 3) {
            return item;
          }
        })
      }
    } else {
      const hacky = {
        Z: 'Ž',
        S: 'Š',
        C: 'Č',
        R: 'Ř',
        D: 'Ď',
        T: 'Ť',
        N: 'Ň'
      };

      const alphabet = {
        A: true, B: true, C: true, Č: true, D: true, Ď: true, E: true, F: true,
        G: true, H: true, I: true, J: true, K: true, L: true, M: true, N: true, Ň: true,
        O: true, P: true, Q: true, R: true, Ř: true, S: true, Š: true, T: true,
        Ť: true, U: true, V: true, W: true, X: true, Y: true, Z: true, Ž: true
      };

      const iHacky = hacky[character];

      if (value.length === 0) {
        return value;
      }
      if (filterString === '') {
        return value.filter(item => {
          if (item.surname && (item.surname[0].toUpperCase() === character ||
              iHacky && item.surname[0] === iHacky ||
              character === '#' && !alphabet[item.surname[0].toUpperCase()])) {
            return item;
          }
        }).sort((a, b) => a.surname.localeCompare(b.surname, 'cs'));
      } else {
        return value.filter(item => {
          if (item.name.toLowerCase().includes(filterString.toLowerCase()) ||
              item.surname.toLowerCase().includes(filterString.toLowerCase())) {
            return item;
          }
        })
      }
    }
  }

}
