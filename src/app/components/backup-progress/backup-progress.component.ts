import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LibraryBackupService } from '../../services/library-backup.service';

@Component({
  selector: 'app-backup-progress',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MatProgressBarModule],
  templateUrl: './backup-progress.component.html',
  styleUrls: ['./backup-progress.component.scss'],
})
export class BackupProgressComponent {
  protected readonly backup = inject(LibraryBackupService);
}
