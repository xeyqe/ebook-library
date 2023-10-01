import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthorsComponent } from 'src/app/pages/authors/authors.page';

const routes: Routes = [
  {
    path: '',
    component: AuthorsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthorsPageRoutingModule { }
