import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { controlValueSignal } from './control-value-signal';

@Component({
  selector: 'app-form-signal-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span>{{ values().title }}</span><span>{{ selectedImage() }}</span>',
})
class FormSignalHost {
  readonly form = new FormGroup({ title: new FormControl({ value: 'Original', disabled: true }) });
  readonly values = controlValueSignal(this.form);
  readonly image = signal(new FormControl('first.jpg'));
  readonly selectedImage = controlValueSignal(this.image);
}

describe('Zoneless reactive form values', () => {
  it('renders an asynchronous update to a disabled control without manually detecting changes', async () => {
    const fixture = TestBed.createComponent(FormSignalHost);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Original');

    await Promise.resolve().then(() => fixture.componentInstance.form.patchValue({ title: 'Downloaded metadata' }));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Downloaded metadata');
    expect(fixture.componentInstance.form.disabled).toBe(true);
  });

  it('subscribes to replacement controls and stops listening to the old control', async () => {
    const fixture = TestBed.createComponent(FormSignalHost);
    await fixture.whenStable();
    const previous = fixture.componentInstance.image();
    const replacement = new FormControl('second.jpg');
    fixture.componentInstance.image.set(replacement);
    await fixture.whenStable();
    previous.setValue('stale.jpg');
    replacement.setValue('downloaded.jpg');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('downloaded.jpg');
    expect(fixture.nativeElement.textContent).not.toContain('stale.jpg');
  });
});
