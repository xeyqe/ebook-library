import { DOCUMENT, Injectable, inject } from '@angular/core';
import { EventManagerPlugin } from '@angular/platform-browser';

@Injectable()
export class PinchEventPlugin extends EventManagerPlugin {
  constructor() {
    super(inject(DOCUMENT));
  }

  supports(eventName: string): boolean {
    return eventName === 'pinchin' || eventName === 'pinchout';
  }

  addEventListener(element: HTMLElement, eventName: string, handler: (event: Event) => void): () => void {
    const manager = new window['Hammer'](element);
    manager.get('pinch').set({ enable: true });
    manager.on(eventName, handler);
    return () => manager.destroy();
  }
}
