import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { AuthorsComponent } from './authors.page';

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('AuthorsComponent', () => {
  let fixture: ComponentFixture<AuthorsComponent>;
  let page: any;
  let ready: BehaviorSubject<boolean>;
  let preferences: Map<string, unknown>;
  let database: any;
  let files: any;
  let dialog: any;
  let working: BusyService;

  const author = { id: 1, name: 'Jane', surname: 'Adams', img: '', progress: 0 };
  const book = { id: 2, title: 'Example book', authors: 'Jane Adams', img: '', progress: '1/3' };

  async function enter() {
    ready.next(true);
    await page.ionViewWillEnter();
  }

  beforeEach(() => {
    ready = new BehaviorSubject(false);
    preferences = new Map();
    database = {
      getDatabaseState: () => ready.asObservable(),
      getValue: vi.fn().mockImplementation(async (key) => preferences.get(key)),
      saveValue: vi.fn().mockResolvedValue(undefined),
      loadAuthors: vi.fn().mockResolvedValue([author]),
      loadBooks: vi.fn().mockResolvedValue([book]),
      findAuthors: vi.fn().mockResolvedValue([author]),
      findBooks: vi.fn().mockResolvedValue([book]),
      exportDB: vi.fn().mockResolvedValue({ authors: [] }),
      getVersion: vi.fn().mockResolvedValue(10),
      importDB: vi.fn().mockResolvedValue(undefined),
    };
    files = {
      downloadUnknownImg: vi.fn().mockResolvedValue(undefined),
      getDBJsons: vi.fn().mockResolvedValue([]),
      write2File: vi.fn().mockResolvedValue(undefined),
    };
    dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        BusyService,
        { provide: DatabaseService, useValue: database },
        { provide: FileReaderService, useValue: files },
        { provide: DirectoryService, useValue: { imgPreLink: 'file://library' } },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    fixture = TestBed.createComponent(AuthorsComponent);
    page = fixture.componentInstance;
    working = TestBed.inject(BusyService);
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits past the initial false database state before loading preferences and authors', async () => {
    const entering = page.ionViewWillEnter();
    await Promise.resolve();
    expect(database.getValue).not.toHaveBeenCalled();
    ready.next(true);
    await entering;
    expect(database.loadAuthors).toHaveBeenCalledWith('A');
    expect(page.selectedCharacter).toBe('A');
    expect(page.visibleAuthors).toEqual([author]);
    expect(page.loading).toBe(false);
    expect(files.downloadUnknownImg).toHaveBeenCalledTimes(1);
  });

  it('refreshes saved filters and last playback when returning to the cached page', async () => {
    await enter();
    preferences.set('where2Search', 'B');
    preferences.set('bookSearchBy', 'finished');
    preferences.set('as', JSON.stringify({ id: 7, type: 'speech' }));
    await page.ionViewWillEnter();
    expect(database.loadBooks).toHaveBeenCalledWith('finished');
    expect(page.visibleBooks).toEqual([book]);
    expect(page.lastListened).toEqual({ id: 7, type: 'speech' });
    expect(files.downloadUnknownImg).toHaveBeenCalledTimes(1);
  });

  it('uses valid defaults when stored preferences are corrupted', async () => {
    preferences.set('as', '{invalid');
    preferences.set('character', 'invalid');
    preferences.set('bookSearchBy', 'invalid');
    preferences.set('where2Search', 'invalid');
    await enter();
    expect(page.lastListened).toBeUndefined();
    expect(page.selectedCharacter).toBe('A');
    expect(page.bookSearchBy).toBe('started');
    expect(page.loadError).toBe('');
  });

  it('reads legacy last-listened IDs as numbers', async () => {
    preferences.set('as', '421');
    await enter();
    expect(page.lastListened).toEqual({ id: 42, type: 'spritz' });
  });

  it('ignores a slow search response after a newer search completes', async () => {
    await enter();
    const slow = deferred<unknown[]>();
    database.findAuthors.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([{ ...author, id: 3 }]);
    page.searchQuery = 'first';
    const first = page.load();
    await Promise.resolve();
    page.searchQuery = 'second';
    await page.load();
    slow.resolve([{ ...author, id: 99 }]);
    await first;
    expect(page.visibleAuthors[0].id).toBe(3);
  });

  it('debounces search and resets to the active filter for short queries', async () => {
    await enter();
    vi.useFakeTimers();
    page.onSearch({ target: { value: 'Jane' } });
    page.onSearch({ target: { value: 'Janet' } });
    await vi.advanceTimersByTimeAsync(500);
    expect(database.findAuthors).toHaveBeenCalledTimes(1);
    expect(database.findAuthors).toHaveBeenCalledWith('Janet');
    page.onSearch({ target: { value: 'Ja' } });
    await vi.advanceTimersByTimeAsync(500);
    expect(database.loadAuthors).toHaveBeenLastCalledWith('A');
  });

  it('searches the newly selected mode without discarding the query', async () => {
    await enter();
    page.searchQuery = 'Example';
    await page.where2SearchFn();
    expect(database.findBooks).toHaveBeenCalledWith('Example');
    expect(page.visibleBooks).toEqual([book]);
  });

  it('ignores a pending author response after switching to books', async () => {
    await enter();
    const slow = deferred<unknown[]>();
    database.loadAuthors.mockReturnValueOnce(slow.promise);
    const loadingAuthors = page.load();
    await Promise.resolve();
    await page.where2SearchFn();
    slow.resolve([{ ...author, id: 99 }]);
    await loadingAuthors;
    expect(page.visibleAuthors).toEqual([author]);
    expect(page.visibleBooks).toEqual([book]);
    expect(page.loading).toBe(false);
  });

  it('cancels pending search timers on leaving the page', async () => {
    await enter();
    vi.useFakeTimers();
    page.onSearch({ target: { value: 'Jane' } });
    page.ionViewWillLeave();
    await vi.advanceTimersByTimeAsync(500);
    expect(database.findAuthors).not.toHaveBeenCalled();
  });

  it('does not apply a query result after the component is destroyed', async () => {
    await enter();
    const slow = deferred<unknown[]>();
    database.loadAuthors.mockReturnValueOnce(slow.promise);
    const loading = page.load();
    await Promise.resolve();
    fixture.destroy();
    slow.resolve([{ ...author, id: 99 }]);
    await loading;
    expect(page.visibleAuthors).toEqual([author]);
  });

  it('paginates in batches and disables further scrolling at the end', async () => {
    database.loadAuthors.mockResolvedValue(Array.from({ length: 21 }, (_, id) => ({ ...author, id })));
    await enter();
    const event = { target: { complete: vi.fn().mockResolvedValue(undefined) } };
    expect(page.visibleAuthors).toHaveLength(10);
    page.onAuthorsIonInfinite(event);
    expect(page.visibleAuthors).toHaveLength(20);
    page.onAuthorsIonInfinite(event);
    expect(page.visibleAuthors).toHaveLength(21);
    expect(page.hasMoreAuthors).toBe(false);
    expect(event.target.complete).toHaveBeenCalledTimes(2);
  });

  it('uses Ionic scroll positions without depending on list DOM structure', () => {
    page.onScroll({ detail: { scrollTop: 50 } });
    expect(page.state).toBe('animated');
    page.onScroll({ detail: { scrollTop: 30 } });
    expect(page.state).toBe('default');
  });

  it('allows retrying after a failed library query', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    database.loadAuthors.mockRejectedValueOnce(new Error('Query failed'));
    await enter();
    expect(page.loadError).toContain('Unable');
    expect(page.loading).toBe(false);
    await page.ionViewWillEnter();
    expect(page.loadError).toBe('');
    expect(page.visibleAuthors).toEqual([author]);
  });

  it('clears the busy overlay and reports export failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dialog.open.mockReturnValue({ afterClosed: () => of(0) });
    files.write2File.mockRejectedValueOnce(new Error('Disk full'));
    await page.onShowDialog();
    expect(page.actionError).toContain('failed');
    expect(working.working).toBe(false);
  });

  it('clears the busy overlay and reports backup lookup failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dialog.open.mockReturnValue({ afterClosed: () => of(1) });
    files.getDBJsons.mockRejectedValueOnce(new Error('Storage unavailable'));
    await page.onShowDialog();
    expect(page.actionError).toContain('failed');
    expect(working.working).toBe(false);
  });

  it('renders empty results and keeps database actions available without a last-read book', async () => {
    database.loadAuthors.mockResolvedValue([]);
    await enter();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No authors found.');
    expect(fixture.nativeElement.querySelector('[aria-label="Export or import database"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Open last read book"]')).toBeNull();
  });
});
