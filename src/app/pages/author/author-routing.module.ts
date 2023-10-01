import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthorComponent } from './author.page';

const routes: Routes = [
  {
    path: '',
    component: AuthorComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthorPageRoutingModule {}
