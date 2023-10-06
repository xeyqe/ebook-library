import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DialogModule } from '../../material/dialog/dialog.module';
import { AuthorsPageRoutingModule } from './authors-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { AuthorsComponent } from 'src/app/pages/authors/authors.page';


@NgModule({
  imports: [
    ApplicationPipesModuleModule,
    AuthorsPageRoutingModule,
    CommonModule,
    FormsModule,
    IonicModule,
    DialogModule,
    ReactiveFormsModule,
  ],
  declarations: [
    AuthorsComponent,
  ]
})
export class AuthorsPageModule { }
