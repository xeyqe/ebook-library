import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';

import { IonicModule } from '@ionic/angular';

import { AuthorPageRoutingModule } from 'src/app/pages/author/author-routing.module';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

import { AuthorPage } from 'src/app/pages/author/author.page';

import { NgsContenteditableModule } from '@ng-stack/contenteditable';

@NgModule({
  imports: [
    ApplicationPipesModuleModule,
    AuthorPageRoutingModule,
    CommonModule,
    FormsModule,
    IonicModule,
    MatAutocompleteModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    NgsContenteditableModule,
    ReactiveFormsModule,
  ],
  declarations: [AuthorPage],
})
export class AuthorPageModule {}
