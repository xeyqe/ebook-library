import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TtsPage } from 'src/app/pages/tts/tts.page';

const routes: Routes = [
  {
    path: '',
    component: TtsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TtsPageRoutingModule { }
