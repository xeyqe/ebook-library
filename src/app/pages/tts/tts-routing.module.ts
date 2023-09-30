import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TtsComponent } from 'src/app/pages/tts/tts.page';

const routes: Routes = [
  {
    path: '',
    component: TtsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TtsPageRoutingModule { }
