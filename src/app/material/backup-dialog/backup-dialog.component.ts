import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type BackupAction = 'save-zip' | 'restore-zip' | 'export-json' | 'import-json';

@Component({
  selector: 'app-backup-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './backup-dialog.component.html',
  styleUrls: ['./backup-dialog.component.scss'],
})
export class BackupDialogComponent {
  readonly zipAvailable = inject<{ zipAvailable: boolean }>(MAT_DIALOG_DATA).zipAvailable;
}
