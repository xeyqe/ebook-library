import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthorsPage } from 'src/app/pages/authors/authors.page';

const routes: Routes = [
  {
    path: '',
    component: AuthorsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthorsPageRoutingModule { }
