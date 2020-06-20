import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BookPageRoutingModule } from './book-routing.module';

import { BookPage } from './book.page';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BookPageRoutingModule,
    ApplicationPipesModuleModule
  ],
  declarations: [BookPage]
})
export class BookPageModule { }
