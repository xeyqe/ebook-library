import { TestBed } from '@angular/core/testing';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookBrowserService } from './book-browser.service';

describe('BookBrowserService', () => {
  let events: Record<'message' | 'loadstop' | 'exit', Subject<any>>;
  let browser: any;
  let service: BookBrowserService;

  beforeEach(() => {
    events = { message: new Subject(), loadstop: new Subject(), exit: new Subject() };
    browser = {
      on: (name: keyof typeof events) => events[name],
      close: vi.fn(),
      executeScript: vi.fn().mockResolvedValue([]),
    };
    TestBed.configureTestingModule({
      providers: [BookBrowserService, { provide: InAppBrowser, useValue: { create: () => browser } }],
    });
    service = TestBed.inject(BookBrowserService);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('extracts metadata with the script sent to the native browser', async () => {
    document.body.innerHTML = `
      <div class="new2 odtop">Summary</div><span class="genre">Fiction</span>
      <span class="category">Originální název:</span> Original title
    `;
    vi.stubGlobal('webkit', {
      messageHandlers: {
        ['cordova_iab']: { postMessage: (payload: string) => events.message.next({ data: JSON.parse(payload) }) },
      },
    });
    browser.executeScript.mockImplementation(({ code }) => {
      new Function(code)();
      return Promise.resolve([]);
    });
    const result = service.read('https://example.test/book');
    events.loadstop.next({});
    await expect(result).resolves.toMatchObject({
      annotation: 'Summary',
      genre: 'Fiction',
      originalTitle: 'Original title',
    });
  });

  it('normalizes scraped metadata and releases browser event listeners', async () => {
    const result = service.read('https://example.test/book');
    events.message.next({
      data: { title: 'Book', length: '200', serie: ' Series ', serieOrder: '2.', genre: 'A , B' },
    });
    await expect(result).resolves.toMatchObject({
      title: 'Book',
      length: 200,
      serie: 'Series',
      serieOrder: 2,
      genre: 'A, B',
    });
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(Object.values(events).every((event) => !event.observed)).toBe(true);
  });

  it('finishes without metadata when the browser is closed', async () => {
    const result = service.read('https://example.test/book');
    events.exit.next({});
    await expect(result).resolves.toBeUndefined();
    expect(Object.values(events).every((event) => !event.observed)).toBe(true);
  });

  it('rejects script failures and closes the browser', async () => {
    browser.executeScript.mockRejectedValue(new Error('Script failed'));
    const result = service.read('https://example.test/book');
    const assertion = expect(result).rejects.toThrow('Script failed');
    events.loadstop.next({});
    await assertion;
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending lookup when its owner is destroyed', async () => {
    const result = service.read('https://example.test/book');
    const assertion = expect(result).rejects.toThrow('Book lookup was cancelled.');
    TestBed.resetTestingModule();
    await assertion;
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(Object.values(events).every((event) => !event.observed)).toBe(true);
  });
});
