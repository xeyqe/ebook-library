import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PercentPipe } from '../pipes/percent2.pipe';
import { FilterJsonPipe } from '../pipes/filter-json2.pipe';



@NgModule({
  declarations: [ PercentPipe, FilterJsonPipe ],
  imports: [
    CommonModule
  ],
  exports: [
    PercentPipe,
    FilterJsonPipe
  ]
})
export class ApplicationPipesModuleModule { }
