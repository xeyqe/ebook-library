import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';


@Component({
  selector: 'app-input-dialog',
  templateUrl: './input-dialog.component.html',
  styleUrls: ['./input-dialog.component.scss']
})
export class InputDialogComponent implements OnInit {
  protected fg: FormGroup<{
    name: FormControl<string>,
    surname: FormControl<string>,
  }>;

  constructor(
    private dialogRef: MatDialogRef<InputDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { header: string }
  ) { }

  ngOnInit(): void {
    this.fg = new FormGroup({
      name: new FormControl(''),
      surname: new FormControl('', [Validators.required]),
    });
  }

  protected onClose() {
    this.dialogRef.close();
  }

  protected onAddAuthor() {
    this.fg.markAllAsTouched();
    if (!this.fg.valid) return;
    this.dialogRef.close(this.fg.value);
  }
}
