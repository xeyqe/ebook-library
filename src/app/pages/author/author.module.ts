import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { IonicModule } from '@ionic/angular';
import { NgsContenteditableModule } from '@ng-stack/contenteditable';

import { PercentPipe } from 'src/app/pipes/percent2.pipe';

import { PictureModule } from '../picture/picture.module';
import { DialogModule } from 'src/app/material/dialog/dialog.module';
import { AuthorPageRoutingModule } from 'src/app/pages/author/author-routing.module';

import { AuthorComponent } from 'src/app/pages/author/author.page';
import { ContenteditableComponent } from 'src/app/components/contenteditable/contenteditable.component';


@NgModule({
  imports: [
    AuthorPageRoutingModule,
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
    MatProgressBarModule,
    MatSelectModule,
    NgsContenteditableModule,
    PercentPipe,
    PictureModule,
    ReactiveFormsModule,
  ],
  declarations: [AuthorComponent],
})
export class AuthorPageModule { }
