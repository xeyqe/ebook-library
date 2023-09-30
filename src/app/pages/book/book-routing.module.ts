import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BookComponent } from './book.page';

const routes: Routes = [
  {
    path: '',
    component: BookComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BookPageRoutingModule { }
