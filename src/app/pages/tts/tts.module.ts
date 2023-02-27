import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatLegacyOptionModule as MatOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';

import { IonicModule } from '@ionic/angular';

import { TtsPageRoutingModule } from 'src/app/pages/tts/tts-routing.module';

import { TtsPage } from 'src/app/pages/tts/tts.page';

@NgModule({
  declarations: [TtsPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatOptionModule,
    MatSelectModule,
    ReactiveFormsModule,
    TtsPageRoutingModule,
  ]
})
export class TtsPageModule { }
