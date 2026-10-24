import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

function deferred<T>() {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Author progress loading', () => {
  it.each(['started', 'liked', 'finished'] as const)(
    'loads %s books with a missing author through the native SQLite wrapper',
    async (filter) => {
      const service = new DatabaseService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
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
      const service = new DatabaseService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
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

  it.each(['getStartedBooks', 'getFinishedBooks', 'getLikedBooks', 'findBooks'] as const)(
    '%s includes author names before publishing books',
    async (method) => {
      const service = new DatabaseService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
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
