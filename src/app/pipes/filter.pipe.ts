import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})

export class FilterPipe implements PipeTransform {

  transform(value: any, filterString: string, character: string): any {
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

    const resultArray = [];
    if (value.length === 0) {
      return value;
    }
    if (filterString === '') {
      for (const item of value) {
        if (item.surname[0].toUpperCase() === character) {
          resultArray.push(item);
        }
        if (iHacky && item.surname[0] === iHacky) {
          resultArray.push(item);
        }

        if (character === '#' && !alphabet[item.surname[0].toUpperCase()]) {
          resultArray.push(item);
        }
      }
    } else {
      for (const item of value) {
        if (item.name.toLowerCase().includes(filterString.toLowerCase()) ||
            item.surname.toLowerCase().includes(filterString.toLowerCase())) {
          resultArray.push(item);
        }
      }
    }
    return resultArray;
  }

}
