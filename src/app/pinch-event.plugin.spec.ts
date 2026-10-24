import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PinchEventPlugin } from './pinch-event.plugin';

describe('PinchEventPlugin', () => {
  it('forwards pinch callbacks without Zone.js and releases the gesture manager', () => {
    const originalHammer = window['Hammer'];
    const destroy = vi.fn();
    const set = vi.fn();
    let listener: (event: Event) => void;
    window['Hammer'] = class {
      get() {
        return { set };
      }
      on(_eventName: string, callback: (event: Event) => void) {
        listener = callback;
      }
      destroy = destroy;
    };

    try {
      TestBed.configureTestingModule({ providers: [PinchEventPlugin] });
      const plugin = TestBed.inject(PinchEventPlugin);
      const event = new Event('pinchout');
      const handler = vi.fn();
      const unsubscribe = plugin.addEventListener(document.createElement('div'), 'pinchout', handler);

      expect(set).toHaveBeenCalledWith({ enable: true });
      listener(event);
      expect(handler).toHaveBeenCalledWith(event);
      unsubscribe();
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      if (originalHammer === undefined) {
        delete window['Hammer'];
      } else {
        window['Hammer'] = originalHammer;
      }
    }
  });
});
