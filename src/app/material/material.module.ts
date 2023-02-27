import { NgModule } from '@angular/core';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import {MatLegacySelectModule as MatSelectModule} from '@angular/material/legacy-select';



const material = [MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatSelectModule];

@NgModule({
  imports: [material],
  exports: [material],
})
export class MaterialModule {}
