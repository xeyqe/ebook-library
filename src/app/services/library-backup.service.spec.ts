import { TestBed } from '@angular/core/testing';
import { Directory } from '@capacitor/filesystem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';
import { DirectoryService } from './directory.service';
import { BACKUP_FILESYSTEM, BACKUP_PICKER, BACKUP_ZIP, LibraryBackupService } from './library-backup.service';

const schema = { authors: '(id INTEGER, path TEXT)', books: '(id INTEGER, path TEXT)', dbInfo: '(version INTEGER)' };
const snapshot = (name: string) => ({
  structure: { tables: schema },
  data: {
    inserts: {
      authors: [{ id: 1, path: '/ebook-library/Author' }],
      books: [{ id: 2, path: `/ebook-library/Author/${name}.epub` }],
      dbInfo: [{ version: 10 }],
    },
  },
});
const original = snapshot('old');
const restored = snapshot('new');
const journalPath = `${Directory.Data}/library-restore.json`;

describe('Encrypted library backups', () => {
  let service: LibraryBackupService;
  let fs: any;
  let zip: any;
  let db: any;
  let picker: any;
  let listeners: Map<string, (event: { progress: number }) => void>;
  let removers: ReturnType<typeof vi.fn>[];
  let nodes: Map<string, string | null>;
  let names: string[];
  let legacy: boolean;
  const key = (directory: string, path: string) => `${directory}/${path}`.replace(/\/$/, '');
  const fromUri = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, '')).replace(/^\/+/, '');
  const missing = () => Object.assign(new Error('Missing'), { code: 'OS-PLUG-FILE-0008' });

  function mkdir(path: string) {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) nodes.set(parts.slice(0, i).join('/'), null);
  }
  function put(path: string, data: string) {
    mkdir(path.slice(0, path.lastIndexOf('/')));
    nodes.set(path, data);
  }
  function remove(path: string) {
    for (const current of [...nodes.keys()])
      if (current === path || current.startsWith(`${path}/`)) nodes.delete(current);
  }

  beforeEach(() => {
    nodes = new Map();
    legacy = false;
    mkdir('CACHE');
    mkdir('DATA');
    mkdir('EXTERNAL_STORAGE/Backups');
    listeners = new Map();
    removers = [];
    put(`${Directory.ExternalStorage}/ebook-library/Author/old.epub`, 'old book');
    names = [
      'database.json',
      'manifest.json',
      'ebook-library/',
      'ebook-library/Author/',
      'ebook-library/Author/new.epub',
    ];
    fs = {
      mkdir: vi.fn(async ({ directory, path }) => {
        mkdir(key(directory, path));
      }),
      getUri: vi.fn(async ({ directory, path }) => ({ uri: `file:///${key(directory, path)}` })),
      writeFile: vi.fn(async ({ directory, path, data }) => {
        put(key(directory, path), data);
      }),
      readFile: vi.fn(async ({ directory, path }) => {
        const data = nodes.get(key(directory, path));
        if (typeof data !== 'string') throw missing();
        return { data };
      }),
      stat: vi.fn(async ({ directory, path }) => {
        if (!nodes.has(key(directory, path))) throw missing();
        return { type: nodes.get(key(directory, path)) === null ? 'directory' : 'file' };
      }),
      deleteFile: vi.fn(async ({ directory, path }) => {
        nodes.delete(directory ? key(directory, path) : fromUri(path));
      }),
      rmdir: vi.fn(async ({ directory, path }) => {
        remove(key(directory, path));
      }),
      readdir: vi.fn(async ({ directory, path }) => {
        const root = directory ? key(directory, path) : fromUri(path);
        if (!nodes.has(root)) throw missing();
        const files = [...nodes]
          .filter(([name]) => name.startsWith(`${root}/`) && !name.slice(root.length + 1).includes('/'))
          .map(([name, value]) => ({
            name: name.slice(root.length + 1),
            type: value === null ? 'directory' : 'file',
            size: value?.length ?? 0,
          }));
        return { files };
      }),
      copy: vi.fn(async ({ directory, from, toDirectory, to }) => {
        const source = directory ? key(directory, from) : fromUri(from);
        if (!nodes.has(source)) throw missing();
        put(toDirectory ? key(toDirectory, to) : fromUri(to), nodes.get(source)!);
      }),
      rename: vi.fn(async ({ directory, from, to }) => {
        const source = directory ? key(directory, from) : fromUri(from),
          target = directory ? key(directory, to) : fromUri(to);
        if (!nodes.has(source)) throw missing();
        if (nodes.get(target) === null) throw new Error('Destination exists');
        for (const [path, value] of [...nodes]) {
          if (path === source || path.startsWith(`${source}/`)) nodes.set(target + path.slice(source.length), value);
        }
        remove(source);
      }),
    };
    zip = {
      addListener: vi.fn(async (event, callback) => {
        listeners.set(event, callback);
        const remove = vi.fn(async () => {
          listeners.delete(event);
        });
        removers.push(remove);
        return { remove };
      }),
      addFolder: vi.fn(async ({ zipFilePath }) => {
        put(fromUri(zipFilePath), 'archive');
      }),
      addFiles: vi.fn(async ({ zipFilePath }) => {
        put(fromUri(zipFilePath), 'archive');
      }),
      isEncrypted: vi.fn(async () => ({ isEncrypted: true })),
      getAllFileNames: vi.fn(async ({ zipFilePath }) => ({
        names: legacy
          ? zipFilePath.endsWith('/backup.zip')
            ? ['library.zip']
            : names
          : ['backup/', ...names.map((name) => `backup/${name}`)],
      })),
      extractAll: vi.fn(async ({ zipFilePath, destDirectory }) => {
        const root = fromUri(destDirectory);
        if (legacy && zipFilePath.endsWith('/backup.zip')) put(`${root}/library.zip`, 'archive');
        else {
          const content = legacy ? root : `${root}/backup`;
          put(`${content}/database.json`, JSON.stringify(restored));
          put(
            `${content}/manifest.json`,
            JSON.stringify({ format: 'ebook-library', version: legacy ? 1 : 2, databaseVersion: 10 }),
          );
          put(`${content}/ebook-library/Author/new.epub`, 'new book');
        }
      }),
    };
    picker = {
      pickDirectory: vi.fn(async () => ({
        path: 'content://com.android.externalstorage.documents/tree/primary%3ABackups',
      })),
      pickFiles: vi.fn(async () => ({ files: [{ path: 'content://provider/backup.elbackup' }] })),
      copyFile: vi.fn(async ({ to }) => {
        put(fromUri(to), 'encrypted archive');
      }),
    };
    db = {
      getSupportedVersion: vi.fn(() => 10),
      exportDB: vi.fn(async () => original),
      getVersion: vi.fn(async () => 10),
      importDB: vi.fn(async () => {}),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: BACKUP_FILESYSTEM, useValue: fs },
        { provide: BACKUP_ZIP, useValue: zip },
        { provide: BACKUP_PICKER, useValue: picker },
        { provide: DatabaseService, useValue: db },
        { provide: DirectoryService, useValue: { dir: Directory.ExternalStorage } },
      ],
    });
    service = TestBed.inject(LibraryBackupService);
  });

  it('creates and encrypts all staged books and database in one archive operation', async () => {
    const addFolder = zip.addFolder.getMockImplementation();
    zip.addFolder.mockImplementation(async (options) => {
      const staging = fromUri(options.folder);
      expect(nodes.get(`${staging}/ebook-library/Author/old.epub`)).toBe('old book');
      expect(JSON.parse(nodes.get(`${staging}/database.json`)!)).toEqual(original);
      expect(JSON.parse(nodes.get(`${staging}/manifest.json`)!)).toMatchObject({ format: 'ebook-library', version: 2 });
      expect(options.password).toBe('correct horse battery');
      expect(options.zipFilePath).toMatch(/^\/EXTERNAL_STORAGE\/Backups\/ebook-library-.*\.partial.zip$/);
      await addFolder(options);
    });
    expect(await service.save('correct horse battery')).toBe(true);
    expect(zip.addFolder).toHaveBeenCalledOnce();
    expect(zip.addFiles).not.toHaveBeenCalled();
    expect(picker.pickDirectory).toHaveBeenCalledOnce();
    expect(fs.rename).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringMatching(/^file:\/\/\/EXTERNAL_STORAGE\/Backups\/ebook-library-.*\.partial.zip$/),
        to: expect.stringMatching(/^file:\/\/\/EXTERNAL_STORAGE\/Backups\/ebook-library-.*\.elbackup$/),
      }),
    );
    expect(
      fs.copy.mock.calls.every(
        ([options]) => options.directory === Directory.ExternalStorage && options.toDirectory === Directory.Cache,
      ),
    ).toBe(true);
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip'))).toBe(false);
    expect([...nodes.keys()].some((name) => name.startsWith('CACHE/library-backup-'))).toBe(false);
    expect(service.status()).toBe('');
  });

  it('never offers an unencrypted archive for saving', async () => {
    zip.isEncrypted.mockResolvedValue({ isEncrypted: false });
    await expect(service.save('password')).rejects.toThrow('could not be verified');
    expect(picker.pickDirectory).toHaveBeenCalledOnce();
    expect(fs.rename).not.toHaveBeenCalled();
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip') || name.endsWith('.elbackup'))).toBe(false);
  });

  it('treats picker cancellation as a quiet no-op and clears temporary files', async () => {
    picker.pickFiles.mockRejectedValueOnce(new Error('pickFiles canceled.'));
    expect(await service.load('password')).toBe(false);
    expect(zip.extractAll).not.toHaveBeenCalled();
    expect(db.importDB).not.toHaveBeenCalled();
    picker.pickDirectory.mockRejectedValueOnce(new Error('pickDirectory canceled.'));
    expect(await service.save('password')).toBe(false);
    expect(db.exportDB).not.toHaveBeenCalled();
    expect(zip.addFolder).not.toHaveBeenCalled();
    expect(fs.copy).not.toHaveBeenCalled();
    expect([...nodes.keys()].some((name) => name.startsWith('CACHE/library-backup-'))).toBe(false);
  });

  it('does not touch the existing library or database for an incorrect password', async () => {
    zip.extractAll.mockRejectedValueOnce(new Error('Wrong password'));
    await expect(service.load('wrong password')).rejects.toThrow('Check the password');
    expect(db.importDB).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
    expect([...nodes.keys()].some((name) => name.startsWith('CACHE/library-backup-'))).toBe(false);
  });

  it.each(['../escape', '/absolute', 'ebook-library/../../escape', 'ebook-library\\escape', 'ebook-library/C:/escape'])(
    'rejects archive traversal before extracting the payload: %s',
    async (entry) => {
      names.push(entry);
      await expect(service.load('password')).rejects.toThrow('unsafe');
      expect(zip.extractAll).not.toHaveBeenCalled();
      expect(fs.rename).not.toHaveBeenCalled();
    },
  );

  it('rejects missing book files before replacing the library', async () => {
    names = names.filter((name) => !name.endsWith('new.epub'));
    await expect(service.load('password')).rejects.toThrow('missing');
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('replaces books and database together and discards rollback data after success', async () => {
    expect(await service.load('password')).toBe(true);
    expect(db.importDB).toHaveBeenCalledWith(JSON.stringify(restored));
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/new.epub')).toBe('new book');
    expect(nodes.has('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe(false);
    expect(nodes.has(journalPath)).toBe(false);
    expect(
      [...nodes.keys()].some(
        (name) => name.includes('.ebook-library-previous-') || name.includes('.ebook-library-incoming-'),
      ),
    ).toBe(false);
  });

  it('rolls back books and database after an import error', async () => {
    db.importDB.mockRejectedValueOnce(new Error('Disk full'));
    await expect(service.load('password')).rejects.toThrow('Disk full');
    expect(db.importDB).toHaveBeenLastCalledWith(JSON.stringify(original));
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
    expect(nodes.has('EXTERNAL_STORAGE/ebook-library/Author/new.epub')).toBe(false);
    expect(nodes.has(journalPath)).toBe(false);
  });

  it('leaves the live library untouched when staging fails', async () => {
    fs.copy.mockRejectedValueOnce(new Error('No space'));
    await expect(service.load('password')).rejects.toThrow('No space');
    expect(fs.rename).not.toHaveBeenCalled();
    expect(db.importDB).not.toHaveBeenCalled();
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
  });

  it('recovers the old library on startup after the process died mid-restore', async () => {
    const id = crypto.randomUUID();
    const previous = `.ebook-library-previous-${id}`,
      incoming = `.ebook-library-incoming-${id}`;
    await fs.rename({ directory: Directory.ExternalStorage, from: 'ebook-library', to: previous });
    put('EXTERNAL_STORAGE/ebook-library/Author/new.epub', 'new book');
    put(journalPath, JSON.stringify({ version: 1, previous, incoming, database: original, committed: false }));
    await service.recoverInterruptedRestore();
    expect(db.importDB).toHaveBeenCalledWith(JSON.stringify(original));
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
    expect(nodes.has('EXTERNAL_STORAGE/ebook-library/Author/new.epub')).toBe(false);
    expect(nodes.has(journalPath)).toBe(false);
  });

  it('retains recovery information when recovery cannot write the database', async () => {
    db.importDB.mockRejectedValue(new Error('No space'));
    await expect(service.load('password')).rejects.toThrow('Restart the app');
    expect(nodes.has(journalPath)).toBe(true);
    expect(
      [...nodes.keys()].some((name) => name.includes('.ebook-library-previous-') && name.endsWith('old.epub')),
    ).toBe(true);
    db.importDB.mockResolvedValue(undefined);
    await service.recoverInterruptedRestore();
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
  });
  it('accepts the same schema from a fresh install even when migrated column order differs', async () => {
    const extract = zip.extractAll.getMockImplementation();
    zip.extractAll.mockImplementation(async (options) => {
      await extract(options);
      if (options.zipFilePath.endsWith('/backup.zip')) {
        const database = structuredClone(restored);
        database.structure.tables.books = '( path TEXT, id INTEGER )';
        put(`${fromUri(options.destDirectory)}/backup/database.json`, JSON.stringify(database));
      }
    });
    expect(await service.load('password')).toBe(true);
  });

  it('rejects an injected SQL schema before modifying live data', async () => {
    const extract = zip.extractAll.getMockImplementation();
    zip.extractAll.mockImplementation(async (options) => {
      await extract(options);
      if (options.zipFilePath.endsWith('/backup.zip')) {
        const database = structuredClone(restored);
        database.structure.tables.books = '(id INTEGER); DROP TABLE authors; --)';
        put(`${fromUri(options.destDirectory)}/backup/database.json`, JSON.stringify(database));
      }
    });
    await expect(service.load('password')).rejects.toThrow('table definition');
    expect(fs.rename).not.toHaveBeenCalled();
    expect(db.importDB).not.toHaveBeenCalled();
  });

  it('only cleans old data after a committed restore was interrupted during cleanup', async () => {
    const id = crypto.randomUUID();
    const previous = `.ebook-library-previous-${id}`,
      incoming = `.ebook-library-incoming-${id}`;
    await fs.rename({ directory: Directory.ExternalStorage, from: 'ebook-library', to: previous });
    put('EXTERNAL_STORAGE/ebook-library/Author/new.epub', 'new book');
    put(journalPath, JSON.stringify({ version: 1, previous, incoming, database: original, committed: true }));
    await service.recoverInterruptedRestore();
    expect(db.importDB).not.toHaveBeenCalled();
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/new.epub')).toBe('new book');
    expect(nodes.has(journalPath)).toBe(false);
  });
  it('accepts an older database with its older schema and passes it to the migration-aware importer', async () => {
    const older = structuredClone(restored);
    older.data.inserts.dbInfo[0].version = 9;
    older.structure.tables.books = '(id INTEGER, path TEXT, creatorId INTEGER)';
    const extract = zip.extractAll.getMockImplementation();
    zip.extractAll.mockImplementation(async (options) => {
      await extract(options);
      if (options.zipFilePath.endsWith('/backup.zip')) {
        put(`${fromUri(options.destDirectory)}/backup/database.json`, JSON.stringify(older));
        put(
          `${fromUri(options.destDirectory)}/backup/manifest.json`,
          JSON.stringify({ format: 'ebook-library', version: 2, databaseVersion: 9 }),
        );
      }
    });
    expect(await service.load('password')).toBe(true);
    expect(db.importDB).toHaveBeenCalledWith(JSON.stringify(older));
  });

  it('cancels a newer database restore and asks the user to update the app before changing anything', async () => {
    const newer = structuredClone(restored);
    newer.data.inserts.dbInfo[0].version = 11;
    const extract = zip.extractAll.getMockImplementation();
    zip.extractAll.mockImplementation(async (options) => {
      await extract(options);
      if (options.zipFilePath.endsWith('/backup.zip')) {
        put(`${fromUri(options.destDirectory)}/backup/database.json`, JSON.stringify(newer));
        put(
          `${fromUri(options.destDirectory)}/backup/manifest.json`,
          JSON.stringify({ format: 'ebook-library', version: 2, databaseVersion: 11 }),
        );
      }
    });
    await expect(service.load('password')).rejects.toThrow('Update ebook-library');
    expect(fs.copy).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
    expect(db.importDB).not.toHaveBeenCalled();
    expect(nodes.get('EXTERNAL_STORAGE/ebook-library/Author/old.epub')).toBe('old book');
  });
  it('checks for an absent recovery journal without rejected stat calls', async () => {
    await service.recoverInterruptedRestore();
    expect(fs.stat).not.toHaveBeenCalled();
    expect(fs.readdir).toHaveBeenCalledWith({ directory: Directory.Data, path: '' });
    expect(db.importDB).not.toHaveBeenCalled();
  });

  it('shows archive progress and removes all operation listeners after success', async () => {
    const addFolder = zip.addFolder.getMockImplementation();
    zip.addFolder.mockImplementation(async (options) => {
      expect(service.active()).toBe(true);
      expect(service.status()).toContain('Creating encrypted');
      listeners.get('addFolderProgressEvent')!({ progress: 37 });
      expect(service.progress()).toBe(37);
      await addFolder(options);
    });
    await service.save('password');
    expect(removers).toHaveLength(1);
    expect(removers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
    expect(listeners.size).toBe(0);
    expect(service.active()).toBe(false);
    expect(service.progress()).toBeNull();
  });

  it('clears listeners and progress after an archive failure', async () => {
    zip.addFolder.mockRejectedValueOnce(new Error('Archive failed'));
    await expect(service.save('password')).rejects.toThrow('Archive failed');
    expect(removers).toHaveLength(1);
    expect(removers[0]).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    expect(service.active()).toBe(false);
    expect(service.progress()).toBeNull();
  });

  it('shows indeterminate progress during finalization and removes the partial archive if renaming fails', async () => {
    fs.rename.mockImplementationOnce(async () => {
      expect(service.active()).toBe(true);
      expect(service.status()).toBe('Saving encrypted backup…');
      expect(service.progress()).toBeNull();
      throw new Error('Storage is full');
    });
    await expect(service.save('password')).rejects.toThrow('Storage is full');
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip') || name.endsWith('.elbackup'))).toBe(false);
    expect(service.active()).toBe(false);
  });

  it('supports SD-card folders and rejects cloud folders with a clear message', async () => {
    picker.pickDirectory.mockResolvedValueOnce({
      path: 'content://com.android.externalstorage.documents/tree/1234-ABCD%3ABooks',
    });
    await service.save('password');
    expect(fs.rename).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringMatching(/^file:\/\/\/storage\/1234-ABCD\/Books\/.*\.elbackup$/) }),
    );
    picker.pickDirectory.mockResolvedValueOnce({ path: 'content://cloud.provider/tree/backups' });
    await expect(service.save('password')).rejects.toThrow('Cloud folders are not supported');
  });

  it('keeps permission errors visible instead of treating them as a missing journal', async () => {
    fs.readdir.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(service.recoverInterruptedRestore()).rejects.toThrow('Permission denied');
  });
  it('supports the Android Documents shortcut and safely encodes spaces in chosen folder names', async () => {
    picker.pickDirectory.mockResolvedValueOnce({
      path: 'content://com.android.externalstorage.documents/tree/home%3AMy%20Backups',
    });
    await service.save('password');
    expect(fs.rename).toHaveBeenCalledWith(
      expect.objectContaining({ to: expect.stringMatching(/^file:\/\/\/DOCUMENTS\/My%20Backups\/.*\.elbackup$/) }),
    );
  });
  it('stops before encryption verification or export if the plugin creates no output', async () => {
    zip.addFolder.mockResolvedValueOnce({ message: 'done' });
    await expect(service.save('password')).rejects.toThrow('did not produce an archive');
    expect(zip.isEncrypted).not.toHaveBeenCalled();
    expect(picker.pickDirectory).toHaveBeenCalledOnce();
    expect(fs.rename).not.toHaveBeenCalled();
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip') || name.endsWith('.elbackup'))).toBe(false);
  });

  it('refuses an empty archive even when the native operation reports success', async () => {
    zip.addFolder.mockImplementationOnce(async ({ zipFilePath }) => {
      put(fromUri(zipFilePath), '');
    });
    await expect(service.save('password')).rejects.toThrow('did not produce an archive');
    expect(zip.isEncrypted).not.toHaveBeenCalled();
  });

  it('decrypts the current format with one extraction and plain filesystem paths', async () => {
    await service.load('password');
    expect(zip.extractAll).toHaveBeenCalledOnce();
    const options = zip.extractAll.mock.calls[0][0];
    expect(options.zipFilePath).toMatch(/^\/CACHE\/.*\/backup.zip$/);
    expect(options.destDirectory).toMatch(/^\/CACHE\/.*\/unpacked$/);
    expect(options.password).toBe('password');
  });

  it('keeps older nested encrypted backups readable', async () => {
    legacy = true;
    expect(await service.load('password')).toBe(true);
    expect(zip.extractAll).toHaveBeenCalledTimes(2);
    expect(db.importDB).toHaveBeenCalledWith(JSON.stringify(restored));
  });
  it('chooses the destination before exporting data, staging books or creating the archive', async () => {
    picker.pickDirectory.mockImplementationOnce(async () => {
      expect(db.exportDB).not.toHaveBeenCalled();
      expect(fs.copy).not.toHaveBeenCalled();
      expect(zip.addFolder).not.toHaveBeenCalled();
      return { path: 'content://com.android.externalstorage.documents/tree/primary%3ABackups' };
    });
    await service.save('password');
  });

  it('deletes an incomplete archive from the chosen folder when creation fails', async () => {
    zip.addFolder.mockImplementationOnce(async ({ zipFilePath }) => {
      put(fromUri(zipFilePath), 'partial encrypted bytes');
      throw new Error('Archive failed');
    });
    await expect(service.save('password')).rejects.toThrow('Archive failed');
    expect(fs.deleteFile).toHaveBeenCalledWith({
      path: expect.stringMatching(/^file:\/\/\/EXTERNAL_STORAGE\/Backups\/.*\.partial.zip$/),
    });
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip') || name.endsWith('.elbackup'))).toBe(false);
  });

  it('tells the user which partial file to remove when cleanup also fails', async () => {
    zip.addFolder.mockImplementationOnce(async ({ zipFilePath }) => {
      put(fromUri(zipFilePath), 'partial encrypted bytes');
      throw new Error('Archive failed');
    });
    fs.deleteFile.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(service.save('password')).rejects.toThrow('Delete the partial file');
    expect([...nodes.keys()].some((name) => name.endsWith('.partial.zip'))).toBe(true);
    expect(service.active()).toBe(false);
  });
});
