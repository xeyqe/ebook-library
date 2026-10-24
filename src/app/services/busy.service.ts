import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BusyService {
  readonly working = signal(false);
  readonly inBg = signal(false);
  readonly isSpeaking = signal(false);

  busy(): void {
    this.working.set(true);
  }
  done(): void {
    this.working.set(false);
  }
}
