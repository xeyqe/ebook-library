import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LibraryBackupService } from '../../services/library-backup.service';
import { BackupProgressComponent } from './backup-progress.component';

function setup() {
  const backup = { status: signal('Packing books…'), progress: signal<number | null>(0) };
  TestBed.configureTestingModule({ providers: [{ provide: LibraryBackupService, useValue: backup }] });
  const fixture = TestBed.createComponent(BackupProgressComponent);
  return { fixture, backup };
}

describe('Backup progress display', () => {
  it('renders live phase and percentage changes without manual change detection', async () => {
    const { fixture, backup } = setup();
    await fixture.whenStable();
    backup.progress.set(47);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Packing books…');
    expect(fixture.nativeElement.textContent).toContain('47%');
    expect(fixture.nativeElement.querySelector('mat-progress-bar').getAttribute('aria-valuenow')).toBe('47');
    backup.status.set('Encrypting backup…');
    backup.progress.set(12);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Encrypting backup…');
    expect(fixture.nativeElement.textContent).toContain('12%');
  });

  it('uses indeterminate progress for phases without measurable progress', async () => {
    const { fixture, backup } = setup();
    backup.status.set('Saving encrypted backup…');
    backup.progress.set(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Saving encrypted backup…');
    expect(fixture.nativeElement.querySelector('.percentage')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-progress-bar').getAttribute('mode')).toBe('indeterminate');
  });
});
