import { NgModule } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

const material = [MatAutocompleteModule, MatFormFieldModule, MatInputModule];

@NgModule({
  imports: [material],
  exports: [material],
})
export class MaterialModule {}
