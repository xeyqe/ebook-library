import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TtsPageRoutingModule } from 'src/app/pages/tts/tts-routing.module';
import { TtsPage } from 'src/app/pages/tts/tts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TtsPageRoutingModule
  ],
  declarations: [TtsPage]
})
export class TtsPageModule { }
