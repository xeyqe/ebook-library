import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'authors', pathMatch: 'full' },
  {
    path: 'authors',
    loadChildren: () => import('./pages/authors/authors.module').then((m) => m.AuthorsPageModule),
  },
  {
    path: 'author/:id',
    loadChildren: () => import('./pages/author/author.module').then((m) => m.AuthorPageModule),
  },
  {
    path: 'book/:id',
    loadChildren: () => import('./pages/book/book.module').then((m) => m.BookPageModule),
  },
  {
    path: 'tts/:id',
    loadChildren: () => import('./pages/tts/tts.module').then((m) => m.TtsPageModule),
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
