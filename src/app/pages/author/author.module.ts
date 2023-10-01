import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { IonicModule } from '@ionic/angular';

import { DialogModule } from 'src/app/material/dialog/dialog.module';
import { AuthorPageRoutingModule } from 'src/app/pages/author/author-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { AuthorComponent } from 'src/app/pages/author/author.page';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

@NgModule({
  imports: [
    ApplicationPipesModuleModule,
    AuthorPageRoutingModule,
    CommonModule,
    FormsModule,
    IonicModule,
    MatAutocompleteModule,
    DialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    NgsContenteditableModule,
    ReactiveFormsModule,
  ],
  declarations: [AuthorComponent],
})
export class AuthorPageModule {}
