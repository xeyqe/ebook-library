import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DialogModule } from '../../material/dialog/dialog.module';
import { AuthorsPageRoutingModule } from './authors-routing.module';
import { InputDialogModule } from 'src/app/material/input-dialog/input-dialog.module';

import { AuthorsComponent } from 'src/app/pages/authors/authors.page';
import { PercentPipe } from 'src/app/pipes/percent2.pipe';


@NgModule({
  imports: [
    PercentPipe,
    AuthorsPageRoutingModule,
    CommonModule,
    DialogModule,
    FormsModule,
    InputDialogModule,
    IonicModule,
    ReactiveFormsModule,
  ],
  declarations: [
    AuthorsComponent,
  ]
})
export class AuthorsPageModule { }
