import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { BookPageRoutingModule } from './book-routing.module';
import { MaterialModule } from 'src/app/material/material.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { BookPage } from './book.page';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BookPageRoutingModule,
    ApplicationPipesModuleModule,
    MaterialModule,
    ReactiveFormsModule,
    MatInputModule,
    NgsContenteditableModule,
    MatSelectModule,
  ],
  providers: [InAppBrowser],
  declarations: [BookPage]
})
export class BookPageModule { }
