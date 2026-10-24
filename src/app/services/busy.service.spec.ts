import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BusyService } from './busy.service';

@Component({
  selector: 'app-busy-test',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '@if (busy.working()) { <span>Working</span> } @if (busy.isSpeaking()) { <span>Speaking</span> }',
})
class BusyHost {
  readonly busy = inject(BusyService);
}

describe('Zoneless busy state', () => {
  it('renders asynchronous service updates without Zone.js or manual change detection', async () => {
    expect(globalThis['Zone']).toBeUndefined();
    const fixture = TestBed.createComponent(BusyHost);
    await fixture.whenStable();
    const busy = TestBed.inject(BusyService);
    await Promise.resolve().then(() => {
      busy.busy();
      busy.isSpeaking.set(true);
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Working');
    expect(fixture.nativeElement.textContent).toContain('Speaking');
    busy.done();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Working');
    expect(fixture.nativeElement.textContent).toContain('Speaking');
  });
});
