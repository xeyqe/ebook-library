import { NgZone, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PinchEventPlugin } from './pinch-event.plugin';

describe('PinchEventPlugin', () => {
  it('runs pinch callbacks inside Angular and releases the gesture manager', () => {
    const originalHammer = window['Hammer'];
    const destroy = jasmine.createSpy('destroy');
    const set = jasmine.createSpy('set');
    let listener: (event: Event) => void;
    window['Hammer'] = jasmine.createSpy('Hammer').and.returnValue({
      get: () => ({ set }),
      on: (_eventName: string, callback: (event: Event) => void) => listener = callback,
      destroy,
    });

    try {
      TestBed.configureTestingModule({ providers: [PinchEventPlugin, provideZoneChangeDetection()] });
      const plugin = TestBed.inject(PinchEventPlugin);
      const event = new Event('pinchout');
      const handler = jasmine.createSpy('handler').and.callFake(() => {
        expect(NgZone.isInAngularZone()).toBeTrue();
      });
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
