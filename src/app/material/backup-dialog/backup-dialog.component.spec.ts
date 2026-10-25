import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { BackupDialogComponent } from './backup-dialog.component';

async function setup(zipAvailable = true) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { zipAvailable } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(BackupDialogComponent);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, close };
}

describe('Backup dialog', () => {
  it.each([
    [0, 'save-zip'],
    [1, 'restore-zip'],
    [2, 'export-json'],
    [3, 'import-json'],
  ])('returns the selected action for button %i', async (index, action) => {
    const { element, close } = await setup();
    expect(element.querySelectorAll('section')).toHaveLength(2);
    element.querySelectorAll<HTMLButtonElement>('section button')[index].click();
    expect(close).toHaveBeenCalledWith(action);
  });

  it('keeps JSON actions available when ZIP backup is unsupported', async () => {
    const { element, close } = await setup(false);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('section button')];
    expect(buttons.map((button) => button.disabled)).toEqual([true, true, false, false]);
    buttons[0].click();
    expect(close).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Available on Android.');
  });
});
