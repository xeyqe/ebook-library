import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'authors', pathMatch: 'full' },
  {
    path: 'authors',
    loadComponent: () => import('./pages/authors/authors.page').then((m) => m.AuthorsComponent)
  },
  {
    path: 'author/:id',
    loadComponent: () => import('./pages/author/author.page').then((m) => m.AuthorComponent)
  },
  {
    path: 'book/:id',
    loadComponent: () => import('./pages/book/book.page').then((m) => m.BookComponent)
  },
  {
    path: 'tts/:id',
    loadComponent: () => import('./pages/tts/tts.page').then((m) => m.TtsComponent)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
