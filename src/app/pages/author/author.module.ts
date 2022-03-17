import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MaterialModule } from 'src/app/material/material.module';
import { AuthorPageRoutingModule } from 'src/app/pages/author/author-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { AuthorPage } from 'src/app/pages/author/author.page';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AuthorPageRoutingModule,
    ApplicationPipesModuleModule,
    MaterialModule,
    NgsContenteditableModule
  ],
  declarations: [AuthorPage],
})
export class AuthorPageModule {}
