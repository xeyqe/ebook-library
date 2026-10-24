import { computed, isSignal, Signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, of, startWith, switchMap } from 'rxjs';

/** Notify templates when reactive form values change, including disabled controls. */
export function controlValueSignal<T extends AbstractControl>(
  control: T | Signal<T>,
): Signal<ReturnType<T['getRawValue']>> {
  const controls = isSignal(control) ? toObservable(control) : of(control);
  const snapshot = toSignal(
    controls.pipe(
      switchMap((current) =>
        current.events.pipe(
          startWith(null),
          map(() => ({ value: current.getRawValue() })),
        ),
      ),
    ),
  );
  return computed(() => snapshot()?.value ?? (isSignal(control) ? control() : control).getRawValue());
}
