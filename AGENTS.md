# Tests

- Write all new and updated TypeScript tests with Vitest. Do not introduce Jasmine or Karma.
- Explicitly import test APIs such as `describe`, `it`, `expect`, lifecycle hooks, and `vi` from `vitest`; do not rely on implicit globals.
- Use `vi.fn()`, `vi.spyOn()`, and Vitest fake timers for mocks, spies, and timer tests. Prefer `async`/`await` for asynchronous tests.
- Keep Angular component tests on `TestBed` where appropriate, using Vitest for assertions and mocks.
- Run tests through the Angular runner: `npm run test:ci`. For a focused run, use `npm run test:ci -- --include src/path/to/example.spec.ts`.
- Run `npm run typecheck` after changing test types or imports.
