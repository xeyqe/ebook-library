import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { BackupPasswordDialogComponent } from './backup-password-dialog.component';

function setup(restoring = false) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { restoring } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(BackupPasswordDialogComponent);
  return { fixture, dialog: fixture.componentInstance, close };
}

describe('Backup password dialog', () => {
  it('requires a long matching password before creating an encrypted backup', async () => {
    const { fixture, dialog, close } = setup();
    dialog.form.setValue({ password: 'short', confirmation: 'short' });
    dialog.submit();
    expect(close).not.toHaveBeenCalled();
    dialog.form.setValue({ password: 'long password here', confirmation: 'different password' });
    dialog.submit();
    expect(close).not.toHaveBeenCalled();
    dialog.form.setValue({ password: 'long password here', confirmation: 'long password here' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
    dialog.submit();
    expect(close).toHaveBeenCalledWith('long password here');
    expect(dialog.form.controls.password.value).toBe('');
  });

  it('updates validation messages after native input events without manual change detection', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const fields = fixture.nativeElement.querySelectorAll('input');
    fields[0].value = 'long password here';
    fields[0].dispatchEvent(new Event('input'));
    fields[1].value = 'mismatch';
    fields[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Passwords do not match.');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('explains replacement and accepts the original password for restore', async () => {
    const { fixture, dialog, close } = setup(true);
    dialog.form.controls.password.setValue('old');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('replaces all current books and the database');
    expect(fixture.nativeElement.querySelectorAll('input')).toHaveLength(1);
    dialog.submit();
    expect(close).toHaveBeenCalledWith('old');
  });

  it('preserves spaces in the encryption password', async () => {
    const { fixture, dialog, close } = setup();
    const password = '  a long passphrase  ';
    dialog.form.setValue({ password, confirmation: password });
    await fixture.whenStable();
    dialog.submit();
    expect(close).toHaveBeenCalledWith(password);
  });
});
