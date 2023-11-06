import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PictureComponent } from './picture.component';


@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [PictureComponent],
  exports: [PictureComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PictureModule { }
