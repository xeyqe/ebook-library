import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';

import { PercentPipe } from 'src/app/pipes/percent2.pipe';

import { PictureModule } from '../picture/picture.module';
import { BookPageRoutingModule } from './book-routing.module';
import { DialogModule } from '../../material/dialog/dialog.module';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

import { BookComponent } from './book.page';
import { ContenteditableComponent } from 'src/app/components/contenteditable/contenteditable.component';


@NgModule({
  imports: [
    BookPageRoutingModule,
    CommonModule,
    ContenteditableComponent,
    DialogModule,
    FormsModule,
    IonicModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    NgsContenteditableModule,
    PercentPipe,
    PictureModule,
    ReactiveFormsModule,
  ],
  providers: [InAppBrowser],
  declarations: [BookComponent]
})
export class BookPageModule { }
