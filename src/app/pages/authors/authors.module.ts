import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';

import { IonicModule } from '@ionic/angular';

import { FilterPipe } from 'src/app/pipes/filter.pipe';

import { AuthorsPageRoutingModule } from './authors-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { AuthorsPage } from 'src/app/pages/authors/authors.page';


@NgModule({
  imports: [
    ApplicationPipesModuleModule,
    AuthorsPageRoutingModule,
    CommonModule,
    FormsModule,
    IonicModule,
    MatDialogModule,
    ReactiveFormsModule,
  ],
  declarations: [
    AuthorsPage,
    FilterPipe
  ]
})
export class AuthorsPageModule { }
