import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { controlValueSignal } from '../../utils/control-value-signal';

@Component({
  selector: 'app-backup-password-dialog',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './backup-password-dialog.component.html',
  styleUrls: ['./backup-password-dialog.component.scss'],
})
export class BackupPasswordDialogComponent {
  readonly restoring = inject<{ restoring: boolean }>(MAT_DIALOG_DATA).restoring;
  private readonly dialogRef = inject(MatDialogRef<BackupPasswordDialogComponent>);
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmation: new FormControl('', { nonNullable: true }),
  });
  readonly values = controlValueSignal(this.form);
  readonly showPassword = signal(false);
  readonly canSubmit = computed(() => {
    const { password, confirmation } = this.values();
    return !!password && (this.restoring || (password.length >= 12 && password === confirmation));
  });

  submit(): void {
    if (!this.canSubmit()) return;
    const password = this.form.controls.password.value;
    this.form.reset();
    this.dialogRef.close(password);
  }
}
