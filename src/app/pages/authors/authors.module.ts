import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AuthorsPageRoutingModule } from './authors-routing.module';
import { AuthorsPage } from 'src/app/pages/authors/authors.page';
import { FilterPipe } from 'src/app/pipes/filter.pipe';
import { ApplicationPipesModuleModule } from 'src/app/application-pipes-module/application-pipes-module.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AuthorsPageRoutingModule, ApplicationPipesModuleModule],
  declarations: [AuthorsPage, FilterPipe]
})
export class AuthorsPageModule { }
