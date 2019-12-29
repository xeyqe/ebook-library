import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})

export class FilterPipe implements PipeTransform {

  transform(value: any, filterString: string, character: string): any {
    const resultArray = [];
    if (value.length === 0) {
      return value;
    }
    if (filterString === '') {
      for (const item of value) {
        if (item.surname[0] === character) {
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
