import { NgModule } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';



const material = [MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatSelectModule];

@NgModule({
  imports: [material],
  exports: [material],
})
export class MaterialModule {}
