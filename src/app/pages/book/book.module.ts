import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { BookPageRoutingModule } from './book-routing.module';
import { MaterialModule } from 'src/app/material/material.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { BookPage } from './book.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BookPageRoutingModule,
    ApplicationPipesModuleModule,
    MaterialModule
  ],
  providers: [InAppBrowser],
  declarations: [BookPage]
})
export class BookPageModule { }
