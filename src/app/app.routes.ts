import { Routes } from '@angular/router';
import { ttsEntryGuard } from './pages/tts/tts-entry.guard';


export const routes: Routes = [
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
        canActivate: [ttsEntryGuard],
        loadComponent: () => import('./pages/tts/tts.page').then((m) => m.TtsComponent)
    }
];


