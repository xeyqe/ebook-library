# Tests

- Write all new and updated TypeScript tests with Vitest. Do not introduce Jasmine or Karma.
- Explicitly import test APIs such as `describe`, `it`, `expect`, lifecycle hooks, and `vi` from `vitest`; do not rely on implicit globals.
- Use `vi.fn()`, `vi.spyOn()`, and Vitest fake timers for mocks, spies, and timer tests. Prefer `async`/`await` for asynchronous tests.
- Keep Angular component tests on `TestBed` where appropriate, using Vitest for assertions and mocks.
- Run tests through the Angular runner: `npm run test:ci`. For a focused run, use `npm run test:ci -- --include src/path/to/example.spec.ts`.
- Run `npm run typecheck` after changing test types or imports.

# Change detection

- Keep the app and tests zoneless. Do not reintroduce Zone.js or `provideZoneChangeDetection`.
- Use signals or computed signals for mutable state read by templates, including updates from native plugins, promises, subscriptions, and timers.
- Update arrays and objects immutably through signal `set`/`update` calls.
- Bridge reactive form values into templates with `controlValueSignal`; keep form controls as controls.
- Test asynchronous rendering with `fixture.whenStable()` where practical, so manual `detectChanges()` does not hide missing notifications.
