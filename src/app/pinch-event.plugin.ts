import { DOCUMENT, Injectable, NgZone, inject } from '@angular/core';
import { EventManagerPlugin } from '@angular/platform-browser';

@Injectable()
export class PinchEventPlugin extends EventManagerPlugin {
  private readonly zone = inject(NgZone);

  constructor() {
    super(inject(DOCUMENT));
  }

  supports(eventName: string): boolean {
    return eventName === 'pinchin' || eventName === 'pinchout';
  }

  addEventListener(element: HTMLElement, eventName: string, handler: (event: Event) => void): () => void {
    return this.zone.runOutsideAngular(() => {
      const manager = new window['Hammer'](element);
      manager.get('pinch').set({ enable: true });
      manager.on(eventName, (event: Event) => this.zone.runGuarded(() => handler(event)));
      return () => manager.destroy();
    });
  }
}
