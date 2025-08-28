import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { PercentPipe } from 'src/app/pipes/percent2.pipe';

import { MatFormFieldModule } from '@angular/material/form-field';
import { DialogModule } from '../../material/dialog/dialog.module';
import { AuthorsPageRoutingModule } from './authors-routing.module';
import { InputDialogModule } from 'src/app/material/input-dialog/input-dialog.module';

import { AuthorsComponent } from 'src/app/pages/authors/authors.page';
import { MatInputModule } from '@angular/material/input';


@NgModule({
  imports: [
    AuthorsPageRoutingModule,
    CommonModule,
    DialogModule,
    FormsModule,
    InputDialogModule,
    IonicModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    PercentPipe,
    ReactiveFormsModule,
  ],
  declarations: [
    AuthorsComponent,
  ]
})
export class AuthorsPageModule { }
