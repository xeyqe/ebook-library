import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PercentPipe } from './../percent2.pipe';


@NgModule({
  declarations: [ PercentPipe ],
  imports: [
    CommonModule
  ],
  exports: [
    PercentPipe
  ]
})
export class ApplicationPipesModuleModule { }
