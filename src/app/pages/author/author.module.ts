import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AuthorPageRoutingModule } from 'src/app/pages/author/author-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';
import { MaterialModule } from 'src/app/material/material.module';
import { AuthorPage } from 'src/app/pages/author/author.page';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AuthorPageRoutingModule,
    ApplicationPipesModuleModule,
    MaterialModule,
  ],
  declarations: [AuthorPage],
})
export class AuthorPageModule {}
