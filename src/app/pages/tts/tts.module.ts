import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

import { IonicModule } from '@ionic/angular';

import { TtsPageRoutingModule } from 'src/app/pages/tts/tts-routing.module';

import { TtsComponent } from 'src/app/pages/tts/tts.page';

@NgModule({
  declarations: [TtsComponent],
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
