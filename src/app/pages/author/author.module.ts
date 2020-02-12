import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AuthorPageRoutingModule } from './author-routing.module';

import { AuthorPage } from './author.page';
import { ApplicationPipesModuleModule } from './../../application-pipes-module/application-pipes-module.module';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AuthorPageRoutingModule,
    ApplicationPipesModuleModule
  ],
  declarations: [AuthorPage]
})
export class AuthorPageModule {}
