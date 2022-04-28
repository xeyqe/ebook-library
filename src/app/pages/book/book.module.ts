import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

import { BookPageRoutingModule } from './book-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

import { BookPage } from './book.page';


@NgModule({
  imports: [
    ApplicationPipesModuleModule,
    BookPageRoutingModule,
    CommonModule,
    FormsModule,
    IonicModule,
    MatAutocompleteModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    NgsContenteditableModule,
    ReactiveFormsModule,
  ],
  providers: [InAppBrowser],
  declarations: [BookPage]
})
export class BookPageModule { }
