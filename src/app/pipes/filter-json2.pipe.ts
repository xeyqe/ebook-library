import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterJson'
})
export class FilterJsonPipe implements PipeTransform {

  transform(value: any, filterString: string): any {
    console.log(value);
    console.log(filterString);
    if (value.length === 0 || filterString === '') {
      return value;
    } else {
      for (const item of value) {
        if (item.surname.toLowerCase().includes(filterString.toLowerCase())) {
          return value;
        }
      }
    }
    return;
  }
}
