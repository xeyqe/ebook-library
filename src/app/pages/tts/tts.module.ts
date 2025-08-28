import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';


import { IonicModule } from '@ionic/angular';

import { TtsPageRoutingModule } from 'src/app/pages/tts/tts-routing.module';

import { TtsComponent } from 'src/app/pages/tts/tts.page';

@NgModule({
  declarations: [TtsComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MatButtonModule, 
    MatChipsModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
    MatSliderModule,
    ReactiveFormsModule,
    TtsPageRoutingModule,
  ]
})
export class TtsPageModule { }
