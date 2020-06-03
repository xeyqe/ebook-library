import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percent2',
})
export class PercentPipe implements PipeTransform {
  transform(value: any, progress: string): any {
    if (!progress) {
      return 0;
    } else if (progress === 'finished') {
      return 100;
    }

    const divided = progress.split('/');
    const lowerValue = parseInt(divided[0], 10);
    const higherValue = parseInt(divided[1], 10);
    const output = Math.floor((lowerValue / higherValue) * 100);

    return output;
  }
}
