import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Platform } from '@ionic/angular';
import { SQLitePorter } from '@awesome-cordova-plugins/sqlite-porter/ngx';
import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';
import { Storage } from '@ionic/storage-angular';
import { DirectoryService } from './directory.service';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

function createDatabase(storage: object = {}, porter: object = {}): DatabaseService {
  TestBed.configureTestingModule({
    providers: [
      { provide: DirectoryService, useValue: {} },
      { provide: HttpClient, useValue: {} },
      { provide: Platform, useValue: {} },
      { provide: SQLitePorter, useValue: porter },
      { provide: SQLite, useValue: {} },
      { provide: Storage, useValue: storage },
    ],
  });
  return TestBed.inject(DatabaseService);
}

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Author progress loading', () => {
  it.each(['started', 'liked', 'lastRead', 'finished'] as const)(
    'loads %s books with a missing author through the native SQLite wrapper',
    async (filter) => {
      const service = createDatabase();
      const book = { id: 7, title: 'Example', creatorIds: '42' };
      const nativeDatabase = {
        executeSql: (sql: string, _params: unknown[], success: (result: unknown) => void) => {
          const records = sql.includes('FROM books') ? [book] : [];
          success({ rows: { length: records.length, item: (index: number) => records[index] } });
        },
      };
      (service as any).database = new SQLiteObject(nativeDatabase);
      await expect(service.loadBooks(filter)).resolves.toEqual([
        expect.objectContaining({ id: 7, title: 'Example', authors: '' }),
      ]);
    },
  );

  it.each(['loadAuthors', 'findAuthors'] as const)(
    '%s waits for progress before publishing author records',
    async (method) => {
      const service = createDatabase();
      const records = [
        { id: 1, name: 'Jane', surname: 'Adams', booksIds: '1,2' },
        { id: 2, name: 'John', surname: 'Anderson', booksIds: '3' },
      ];
      (service as any).database = {
        executeSql: vi
          .fn()
          .mockResolvedValue({ rows: { length: records.length, item: (index: number) => records[index] } }),
      };
      const first = deferred<number>();
      const second = deferred<number>();
      const progress = vi
        .spyOn(service as any, 'getAuthorsProgress')
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      let published = false;
      const loading = service[method]('A').then((authors) => {
        published = true;
        return authors;
      });
      await vi.waitFor(() => expect(progress).toHaveBeenCalledTimes(2));
      first.resolve(0.5);
      await Promise.resolve();
      expect(published).toBe(false);
      second.resolve(0.75);
      expect((await loading).map((author) => author.progress)).toEqual([0.5, 0.75]);
    },
  );

  it.each(['getStartedBooks', 'getLastReadBooks', 'getFinishedBooks', 'getLikedBooks', 'findBooks'] as const)(
    '%s includes author names before publishing books',
    async (method) => {
      const service = createDatabase();
      const record = { id: 7, title: 'Example', creatorIds: '42' };
      (service as any).database = {
        executeSql: vi.fn().mockResolvedValue({ rows: { length: 1, item: () => record } }),
      };
      const name = deferred<string>();
      const lookup = vi.spyOn(service as any, 'getAutorsStr').mockReturnValue(name.promise);
      let published = false;
      const loading = service[method]('Example').then((books) => {
        published = true;
        return books;
      });
      await vi.waitFor(() => expect(lookup).toHaveBeenCalled());
      expect(published).toBe(false);
      name.resolve('Jane Adams');
      expect((await loading)[0].authors).toBe('Jane Adams');
    },
  );
});

describe('DatabaseService persistence', () => {
  function setup(records: unknown[] = []) {
    const storage = { set: vi.fn() };
    const service = createDatabase(storage);
    const executeSql = vi
      .fn()
      .mockResolvedValue({ rows: { length: records.length, item: (index: number) => records[index] }, insertId: 9 });
    (service as any).database = { executeSql };
    return { service, executeSql, storage };
  }

  it('loads read books newest first, including finished books and excluding never-read books', async () => {
    const { service, executeSql } = setup();
    await service.loadBooks('lastRead');
    expect(executeSql).toHaveBeenCalledWith(
      'SELECT id, title, progress, img, creatorIds FROM books WHERE lastRead IS NOT NULL ORDER BY lastRead DESC, title COLLATE NOCASE ASC',
      [],
    );
  });

  it.each(['findAuthors', 'findBooks'] as const)(
    'binds search text in %s instead of embedding it in SQL',
    async (method) => {
      const { service, executeSql } = setup();
      const query = 'O\'Brien "';
      await service[method](query);
      expect(executeSql.mock.calls[0][0]).not.toContain(query);
      expect(executeSql.mock.calls[0][1]).toEqual(Array(method === 'findAuthors' ? 3 : 2).fill(`%${query}%`));
    },
  );

  it.each([
    [['1/1', '1/1'], 1],
    [['1/2', null], 0.25],
    [['0/0', 'bad'], 0],
  ])('calculates finite author progress for %j', async (progresses, expected) => {
    const { service } = setup((progresses as (string | null)[]).map((progress) => ({ progress })));
    await expect((service as any).getAuthorsProgress([1, 2])).resolves.toBe(expected);
  });

  it('does not mutate input models when adding records', async () => {
    const { service } = setup();
    const author = Object.freeze({ id: null, booksIds: Object.freeze([1, 2]) });
    const book = Object.freeze({ id: null, creatorIds: null, added: new Date() });
    await expect(service.addAuthor(author as any)).resolves.toBe(9);
    await expect(service.addBook(book as any)).resolves.toBe(9);
    expect(author.booksIds).toEqual([1, 2]);
    expect(book.added).toBeInstanceOf(Date);
  });

  it('propagates failed author writes and preference saves', async () => {
    const { service, executeSql, storage } = setup();
    executeSql.mockRejectedValue(new Error('Database locked'));
    await expect(service.updateAuthor({ id: 1, booksIds: [] } as any)).rejects.toThrow('Database locked');
    storage.set.mockRejectedValue(new Error('Storage unavailable'));
    await expect(service.saveValue('setting', true)).rejects.toThrow('Storage unavailable');
  });

  it('detaches a deleted author from books shared with another author', async () => {
    const { service } = setup();
    vi.spyOn(service, 'getAuthor').mockResolvedValue({ id: 1, booksIds: [5] } as any);
    vi.spyOn(service, 'getBook').mockResolvedValue({ id: 5, creatorIds: [1, 2] } as any);
    const update = vi.spyOn(service, 'updateBook').mockResolvedValue(undefined);
    const remove = vi.spyOn(service, 'deleteBook').mockResolvedValue(undefined);
    await service.deleteAuthor(1);
    expect(update).toHaveBeenCalledWith({ id: 5, creatorIds: [2] });
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not reset an existing database after a read failure', async () => {
    const { service, executeSql } = setup();
    executeSql.mockRejectedValue(new Error('Permission denied'));
    await expect((service as any).seedDatabase()).rejects.toThrow('Permission denied');
  });
});

describe('Database backup validation', () => {
  it.each(['invalid json', '{}', '{"structure":{"tables":{}}}'])(
    'rejects invalid backups without wiping the library: %s',
    async (backup) => {
      const wipeDb = vi.fn();
      const service = createDatabase({}, { wipeDb });
      await expect(service.importDB(backup)).rejects.toThrow();
      expect(wipeDb).not.toHaveBeenCalled();
    },
  );
});

describe('Atomic database imports', () => {
  const backup = {
    structure: {
      tables: { authors: '(id INTEGER, name TEXT)', books: '(id INTEGER, title TEXT)', dbInfo: '(version INTEGER)' },
    },
    data: {
      inserts: { authors: [{ name: 'Author', id: 1 }], books: [{ title: 'Book', id: 2 }], dbInfo: [{ version: 10 }] },
    },
  };

  it('submits replacement tables and records in one native transaction', async () => {
    const service = createDatabase();
    const sqlBatch = vi.fn().mockResolvedValue(undefined);
    (service as any).database = {
      sqlBatch,
      executeSql: vi.fn().mockResolvedValue({ rows: { length: 1, item: () => ({ version: 10 }) } }),
    };
    await service.importDB(JSON.stringify(backup));
    expect(sqlBatch).toHaveBeenCalledTimes(1);
    expect(sqlBatch.mock.calls[0][0]).toContainEqual(['INSERT INTO authors (name, id) VALUES (?, ?)', ['Author', 1]]);
    expect(sqlBatch.mock.calls[0][0][0]).toEqual(['DROP TABLE IF EXISTS authors', []]);
  });

  it('runs takeCareOfUpdateDB after importing an older database', async () => {
    const service = createDatabase();
    const older = structuredClone(backup);
    older.data.inserts.dbInfo[0].version = 9;
    const sqlBatch = vi.fn().mockResolvedValue(undefined);
    (service as any).database = {
      sqlBatch,
      executeSql: vi.fn().mockResolvedValue({ rows: { length: 1, item: () => ({ version: 9 }) } }),
    };
    const migrate = vi.spyOn(service as any, 'setVersion').mockResolvedValue(undefined);
    const update = vi.spyOn(service as any, 'takeCareOfUpdateDB');
    await service.importDB(JSON.stringify(older));
    expect(sqlBatch.mock.calls[0][0]).toContainEqual(['INSERT INTO dbInfo (version) VALUES (?)', [9]]);
    expect(update).toHaveBeenCalledOnce();
    expect(migrate).toHaveBeenCalledWith(10);
  });

  it('asks for an app update before importing a newer database', async () => {
    const service = createDatabase();
    const newer = structuredClone(backup);
    newer.data.inserts.dbInfo[0].version = service.getSupportedVersion() + 1;
    const sqlBatch = vi.fn();
    (service as any).database = { sqlBatch };
    await expect(service.importDB(JSON.stringify(newer))).rejects.toThrow('Update ebook-library');
    expect(sqlBatch).not.toHaveBeenCalled();
  });

  it('propagates a failed transaction without running migrations', async () => {
    const service = createDatabase();
    const sqlBatch = vi.fn().mockRejectedValue(new Error('Disk full'));
    const executeSql = vi.fn();
    (service as any).database = { sqlBatch, executeSql };
    await expect(service.importDB(JSON.stringify(backup))).rejects.toThrow('Disk full');
    expect(executeSql).not.toHaveBeenCalled();
  });
});
