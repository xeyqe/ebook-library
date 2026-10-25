import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Zip4J } from 'capacitor-zip4j';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { DatabaseService } from './database.service';
import { DirectoryService } from './directory.service';
import { DBJSON } from './interfaces';

export const BACKUP_FILESYSTEM = new InjectionToken<typeof Filesystem>('Backup filesystem', {
  providedIn: 'root',
  factory: () => Filesystem,
});
export const BACKUP_ZIP = new InjectionToken<typeof Zip4J>('Backup ZIP', {
  providedIn: 'root',
  factory: () => Zip4J,
});

export const BACKUP_PICKER = new InjectionToken<Pick<typeof FilePicker, 'pickDirectory' | 'pickFiles' | 'copyFile'>>(
  'Backup file picker',
  {
    providedIn: 'root',
    factory: () => FilePicker,
  },
);

const JOURNAL = 'library-restore.json';
const LIBRARY = 'ebook-library';
interface RestoreJournal {
  version: 1;
  previous: string;
  incoming: string;
  database: DBJSON;
  committed: boolean;
}

@Injectable({ providedIn: 'root' })
export class LibraryBackupService {
  readonly available = Capacitor.getPlatform() === 'android';
  readonly status = signal('');
  readonly progress = signal<number | null>(null);
  readonly active = signal(false);
  private readonly fs = inject(BACKUP_FILESYSTEM);
  private readonly zip = inject(BACKUP_ZIP);
  private readonly picker = inject(BACKUP_PICKER);
  private readonly db = inject(DatabaseService);
  private readonly dir = inject(DirectoryService);
  private stagedFiles = 0;
  private totalFiles = 0;

  async save(password: string): Promise<boolean> {
    return this.withWorkspace(password, async (workspace) => {
      this.phase('Choose a save folder on this device or SD card…');
      const selected = await this.pick(() => this.picker.pickDirectory());
      if (!selected) return false;
      const folder = await this.localFolder(selected.path);
      const stem = `ebook-library-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}`;
      const partialName = `${stem}.partial.zip`;
      const archive = `${folder}/${partialName}`;
      const destination = `${folder}/${stem}.elbackup`;
      let archiveStarted = false;
      try {
        this.phase('Preparing books and database…');
        const database = await this.db.exportDB();
        const version = await this.db.getVersion();
        const staging = `${workspace}/backup`;
        await this.fs.mkdir({ directory: Directory.Cache, path: staging, recursive: true });
        await this.writeJson(`${staging}/database.json`, database);
        await this.writeJson(`${staging}/manifest.json`, {
          format: 'ebook-library',
          version: 2,
          databaseVersion: version,
          createdAt: new Date().toISOString(),
        });
        this.phase('Preparing books for backup…');
        this.stagedFiles = 0;
        this.totalFiles = await this.countFiles(this.dir.dir, LIBRARY);
        await this.copyTree(this.dir.dir, LIBRARY, Directory.Cache, `${staging}/${LIBRARY}`);
        this.phase('Creating encrypted backup…');
        const zipFilePath = this.zipPath(archive);
        const archiveFolder = this.zipPath(await this.uri(Directory.Cache, staging));
        // Create and encrypt directly in the selected folder. Keep the temporary ZIP
        // extension until verified, then publish it with a same-folder rename.
        archiveStarted = true;
        await this.runZip('addFolderProgressEvent', () =>
          this.zip.addFolder({ zipFilePath, folder: archiveFolder, password }),
        );
        const { files } = await this.fs.readdir({ path: folder });
        const output = files.find((file) => file.name === partialName && file.type === 'file');
        if (!output || !output.size)
          throw new Error('Backup creation did not produce an archive. No backup was saved.');
        this.phase('Verifying encrypted backup…');
        try {
          if (!(await this.zip.isEncrypted({ zipFilePath })).isEncrypted)
            throw new Error('The backup is not encrypted.');
        } catch (error) {
          console.error('Backup archive verification failed', error);
          throw new Error('The backup archive could not be verified. No backup was saved.');
        }
        this.phase('Saving encrypted backup…');
        await this.fs.rename({ from: archive, to: destination });
        return true;
      } catch (error) {
        if (archiveStarted) {
          try {
            await this.removePartialBackup(folder, partialName);
          } catch (cleanupError) {
            console.error('Unable to remove partial backup', cleanupError);
            throw new Error(
              `${error?.message || 'Backup failed.'} Delete the partial file "${partialName}" from the selected folder before retrying.`,
            );
          }
        }
        throw error;
      }
    });
  }

  async load(password: string): Promise<boolean> {
    return this.withWorkspace(password, async (workspace) => {
      this.phase('Choose an .elbackup file…');
      const archive = await this.uri(Directory.Cache, `${workspace}/backup.zip`);
      const selected = await this.pick(() => this.picker.pickFiles({ limit: 1, readData: false }));
      if (!selected) return false;
      const source = selected.files[0]?.path;
      if (!source) throw new Error('The selected backup cannot be opened. Choose a file stored on your device.');
      this.phase('Copying selected backup…');
      await this.picker.copyFile({ from: source, to: archive, overwrite: false });
      this.phase('Decrypting and checking backup…');
      const zipFilePath = this.zipPath(archive);
      const outer = await this.zip.getAllFileNames({ zipFilePath });
      if (!(await this.zip.isEncrypted({ zipFilePath })).isEncrypted) {
        throw new Error('Choose an encrypted ebook-library backup (.elbackup).');
      }
      const legacy = outer.names.length === 1 && outer.names[0] === 'library.zip';
      const unpacked = `${workspace}/unpacked`;
      let names: string[];
      let restoredRoot: string;
      if (legacy) {
        // Keep older nested backups readable; new backups use a single encrypted ZIP.
        const payloadDir = await this.uri(Directory.Cache, `${workspace}/payload`);
        await this.decrypt(zipFilePath, this.zipPath(payloadDir), password);
        const payload = this.zipPath(`${payloadDir}/library.zip`);
        names = (await this.zip.getAllFileNames({ zipFilePath: payload })).names;
        this.validateEntries(names);
        this.phase('Unpacking books and database…');
        const destDirectory = this.zipPath(await this.uri(Directory.Cache, unpacked));
        await this.runZip('extractAllProgressEvent', () =>
          this.zip.extractAll({ zipFilePath: payload, destDirectory }),
        );
        restoredRoot = unpacked;
      } else {
        if (outer.names.some((name) => !name.startsWith('backup/'))) throw new Error('Invalid library backup layout.');
        names = outer.names.filter((name) => name !== 'backup/').map((name) => name.slice('backup/'.length));
        this.validateEntries(names);
        await this.decrypt(zipFilePath, this.zipPath(await this.uri(Directory.Cache, unpacked)), password);
        restoredRoot = `${unpacked}/backup`;
      }
      const manifest = await this.readJson(Directory.Cache, `${restoredRoot}/manifest.json`);
      const database = await this.readJson(Directory.Cache, `${restoredRoot}/database.json`);
      const original = await this.db.exportDB();
      if (
        manifest?.format !== 'ebook-library' ||
        manifest.version !== (legacy ? 1 : 2) ||
        !Number.isInteger(manifest.databaseVersion) ||
        manifest.databaseVersion < 1
      ) {
        throw new Error('This backup format is invalid or incompatible with this app.');
      }
      this.validateDatabase(database, names, manifest.databaseVersion);

      this.phase('Preparing restored books…');
      this.stagedFiles = 0;
      this.totalFiles = names.filter((name) => name.startsWith(`${LIBRARY}/`) && !name.endsWith('/')).length;
      const id = crypto.randomUUID();
      const journal: RestoreJournal = {
        version: 1,
        previous: `.ebook-library-previous-${id}`,
        incoming: `.ebook-library-incoming-${id}`,
        database: original,
        committed: false,
      };
      try {
        // Stage on the same volume as the library so the final directory moves are local.
        await this.copyTree(Directory.Cache, `${restoredRoot}/${LIBRARY}`, this.dir.dir, journal.incoming);
        await this.writeJournal(journal);
        this.phase('Restoring library…');
        await this.move(LIBRARY, journal.previous);
        await this.move(journal.incoming, LIBRARY);
        await this.db.importDB(JSON.stringify(database));
        await this.writeJournal({ ...journal, committed: true });
      } catch (error) {
        // A durable journal also allows recovery if Android kills the process mid-restore.
        try {
          await this.recoverInterruptedRestore();
        } catch {
          throw new Error('Restore was interrupted. The previous library is retained. Restart the app to recover it.');
        }
        await this.removeTree(this.dir.dir, journal.incoming);
        throw error;
      }
      // Cleanup failure must not turn a completed restore into a reported failure.
      await this.recoverInterruptedRestore().catch((error) =>
        console.error('Backup cleanup will retry on startup', error),
      );
      return true;
    });
  }

  /** Called after opening the database and before the library UI is made available. */
  async recoverInterruptedRestore(): Promise<void> {
    if (!(await this.exists(Directory.Data, JOURNAL))) return;
    const journal = (await this.readJson(Directory.Data, JOURNAL)) as RestoreJournal;
    if (
      journal?.version !== 1 ||
      !/^\.ebook-library-previous-[a-f0-9-]{36}$/.test(journal.previous) ||
      !/^\.ebook-library-incoming-[a-f0-9-]{36}$/.test(journal.incoming) ||
      typeof journal.committed !== 'boolean'
    ) {
      throw new Error('Invalid restore recovery information.');
    }
    if (!journal.committed) {
      await this.db.importDB(JSON.stringify(journal.database));
      if (await this.exists(this.dir.dir, journal.previous)) {
        await this.removeTree(this.dir.dir, LIBRARY);
        await this.move(journal.previous, LIBRARY);
      }
    }
    await this.removeTree(this.dir.dir, journal.previous);
    await this.removeTree(this.dir.dir, journal.incoming);
    await this.fs.deleteFile({ directory: Directory.Data, path: JOURNAL });
  }

  private async withWorkspace(password: string, operation: (workspace: string) => Promise<boolean>): Promise<boolean> {
    if (!password) throw new Error('Enter a backup password.');
    if (this.active()) throw new Error('Another backup operation is already running.');
    this.active.set(true);
    this.phase('Preparing library backup…');
    const workspace = `library-backup-${crypto.randomUUID()}`;
    try {
      await this.recoverInterruptedRestore();
      await this.fs.mkdir({ directory: Directory.Cache, path: workspace, recursive: true });
      return await operation(workspace);
    } finally {
      await this.removeTree(Directory.Cache, workspace).catch((error) =>
        console.error('Unable to clear backup cache', error),
      );
      this.phase('');
      this.active.set(false);
    }
  }

  private validateEntries(names: string[]): void {
    const seen = new Set<string>();
    for (const name of names) {
      const normalized = name.replace(/\/$/, '');
      if (
        !normalized ||
        name.includes('\\') ||
        name.includes(':') ||
        /[\x00-\x1f]/.test(name) ||
        normalized.split('/').some((part) => !part || part === '.' || part === '..') ||
        seen.has(normalized) ||
        !(
          name === 'database.json' ||
          name === 'manifest.json' ||
          normalized === LIBRARY ||
          name.startsWith(`${LIBRARY}/`)
        )
      ) {
        throw new Error('The backup contains unsafe or unexpected file paths.');
      }
      seen.add(normalized);
    }
    if (
      !seen.has('database.json') ||
      !seen.has('manifest.json') ||
      !names.some((name) => name.startsWith(`${LIBRARY}/`))
    ) {
      throw new Error('The backup is missing its database or books.');
    }
  }

  private validateDatabase(snapshot: DBJSON, names: string[], manifestVersion: number): void {
    const inserts = snapshot?.data?.inserts;
    const backupVersion = inserts?.dbInfo?.[0]?.version;
    if (manifestVersion > this.db.getSupportedVersion() || backupVersion > this.db.getSupportedVersion()) {
      throw new Error('This backup was created by a newer app. Update ebook-library before restoring it.');
    }
    if (
      !snapshot?.structure?.tables ||
      !Array.isArray(inserts?.authors) ||
      !Array.isArray(inserts?.books) ||
      inserts?.dbInfo?.length !== 1 ||
      !Number.isInteger(backupVersion) ||
      backupVersion < 1 ||
      backupVersion !== manifestVersion
    ) {
      throw new Error('The backup database is invalid or incompatible.');
    }
    for (const table of ['authors', 'books', 'dbInfo']) this.validateTableDefinition(snapshot.structure.tables[table]);
    const entries = new Set(names.map((name) => name.replace(/\/$/, '')));
    for (const record of [...inserts.authors, ...inserts.books]) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid database record.');
      for (const key of ['path', 'img']) {
        const value = record[key];
        if (value == null || value === '' || (key === 'img' && /^https?:\/\//.test(value))) continue;
        if (typeof value !== 'string') throw new Error('Invalid library path in database.');
        const path = value.replace(/^\//, '').replace(/\/$/, '');
        if (
          !(path === LIBRARY || path.startsWith(`${LIBRARY}/`)) ||
          path.includes('\\') ||
          path.includes(':') ||
          path.split('/').some((part) => !part || part === '.' || part === '..')
        ) {
          throw new Error('The backup database references a file outside the library.');
        }
        if (key === 'path' && !entries.has(path) && !names.some((name) => name.startsWith(`${path}/`))) {
          throw new Error(`A book or folder referenced by the database is missing: ${path}`);
        }
      }
    }
  }

  private validateTableDefinition(definition: unknown): void {
    if (typeof definition !== 'string' || !/^\([\s\S]*\)$/.test(definition.trim())) {
      throw new Error('Invalid backup table definition.');
    }
    definition
      .trim()
      .slice(1, -1)
      .split(',')
      .map((column) => {
        const normalized = column.trim().replace(/\s+/g, ' ').toUpperCase();
        if (!/^[A-Z][A-Z0-9_]* (INTEGER|TEXT|REAL|BLOB|NUMERIC)( PRIMARY KEY( AUTOINCREMENT)?)?$/.test(normalized)) {
          throw new Error('Invalid backup table definition.');
        }
        return normalized;
      });
  }

  private zipPath(uri: string): string {
    if (uri.startsWith('/')) return uri;
    const parsed = new URL(uri);
    if (parsed.protocol !== 'file:' || parsed.hostname) throw new Error('ZIP operations require a local file.');
    return decodeURIComponent(parsed.pathname);
  }

  private async decrypt(zipFilePath: string, destDirectory: string, password: string): Promise<void> {
    this.phase('Decrypting books and database…');
    try {
      await this.runZip('extractAllProgressEvent', () => this.zip.extractAll({ zipFilePath, destDirectory, password }));
    } catch {
      throw new Error('Unable to decrypt the backup. Check the password; the file may also be damaged.');
    }
  }

  private async countFiles(directory: Directory, path: string): Promise<number> {
    const { files } = await this.fs.readdir({ directory, path });
    let count = 0;
    for (const file of files) {
      if (!file.name || /[/\\]/.test(file.name) || file.name === '.' || file.name === '..')
        throw new Error('Invalid library filename.');
      count += file.type === 'directory' ? await this.countFiles(directory, `${path}/${file.name}`) : 1;
    }
    return count;
  }

  private async copyTree(fromDirectory: Directory, from: string, toDirectory: Directory, to: string): Promise<void> {
    await this.fs.mkdir({ directory: toDirectory, path: to, recursive: true });
    const { files } = await this.fs.readdir({ directory: fromDirectory, path: from });
    for (const file of files) {
      if (!file.name || /[/\\]/.test(file.name) || file.name === '.' || file.name === '..')
        throw new Error('Invalid library filename.');
      if (file.type === 'directory')
        await this.copyTree(fromDirectory, `${from}/${file.name}`, toDirectory, `${to}/${file.name}`);
      else {
        await this.fs.copy({
          directory: fromDirectory,
          from: `${from}/${file.name}`,
          toDirectory,
          to: `${to}/${file.name}`,
        });
        this.stagedFiles++;
        this.progress.set(
          this.totalFiles ? Math.min(100, Math.round((this.stagedFiles / this.totalFiles) * 100)) : null,
        );
      }
    }
  }

  private phase(message: string): void {
    this.status.set(message);
    this.progress.set(null);
  }

  private async runZip(
    event: 'addFolderProgressEvent' | 'addFilesProgressEvent' | 'extractAllProgressEvent',
    operation: () => Promise<unknown>,
  ): Promise<void> {
    this.progress.set(0);
    const listener = await this.zip.addListener(event, ({ progress }) => {
      if (Number.isFinite(progress)) this.progress.set(Math.max(0, Math.min(100, Math.round(progress))));
    });
    try {
      await operation();
      this.progress.set(100);
    } finally {
      await listener.remove();
    }
  }

  private async pick<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      if (/^pick(?:Directory|Files) cancel(?:ed|led)\.?$/i.test(error?.message || '')) return undefined;
      throw error;
    }
  }

  private async localFolder(path: string): Promise<string> {
    const unsupported = () =>
      new Error(
        'Choose a folder in internal storage or on your SD card. Cloud folders are not supported for saving backups.',
      );
    if (path.startsWith('file://')) return path.replace(/\/$/, '');
    const uri = new URL(path);
    if (uri.protocol !== 'content:' || uri.hostname !== 'com.android.externalstorage.documents') throw unsupported();
    const match = /^\/tree\/([^/]+)\/?$/.exec(uri.pathname);
    if (!match) throw unsupported();
    const document = decodeURIComponent(match[1]);
    const colon = document.indexOf(':');
    if (colon < 0) throw unsupported();
    const volume = document.slice(0, colon);
    const relative = document.slice(colon + 1);
    const parts = relative ? relative.split('/') : [];
    if (parts.some((part) => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) throw unsupported();
    let root: string;
    if (volume.toLowerCase() === 'primary') root = await this.uri(Directory.ExternalStorage, '');
    // Android's Documents provider also exposes the public Documents folder as home:.
    else if (volume.toLowerCase() === 'home') root = await this.uri(Directory.Documents, '');
    else if (/^[a-f0-9]{4}-[a-f0-9]{4}$/i.test(volume)) root = `file:///storage/${volume}`;
    else throw unsupported();
    return `${root.replace(/\/$/, '')}${parts.length ? '/' + parts.map(encodeURIComponent).join('/') : ''}`;
  }

  private async removePartialBackup(folder: string, name: string): Promise<void> {
    const { files } = await this.fs.readdir({ path: folder });
    if (files.some((file) => file.name === name)) await this.fs.deleteFile({ path: `${folder}/${name}` });
  }

  private async writeJournal(journal: RestoreJournal): Promise<void> {
    // Publish a complete recovery record; never overwrite a live journal in place.
    await this.fs.writeFile({
      directory: Directory.Data,
      path: `${JOURNAL}.tmp`,
      data: JSON.stringify(journal),
      encoding: Encoding.UTF8,
    });
    await this.fs.rename({ directory: Directory.Data, from: `${JOURNAL}.tmp`, to: JOURNAL });
  }

  private move(from: string, to: string): Promise<void> {
    return this.fs.rename({ directory: this.dir.dir, from, to });
  }
  private async uri(directory: Directory, path: string): Promise<string> {
    return (await this.fs.getUri({ directory, path })).uri;
  }
  private async writeJson(path: string, value: unknown): Promise<void> {
    await this.fs.writeFile({ directory: Directory.Cache, path, data: JSON.stringify(value), encoding: Encoding.UTF8 });
  }
  private async readJson(directory: Directory, path: string): Promise<any> {
    const { data } = await this.fs.readFile({ directory, path, encoding: Encoding.UTF8 });
    if (typeof data !== 'string') throw new Error('Unable to read the backup metadata.');
    return JSON.parse(data);
  }
  private async exists(directory: Directory, path: string): Promise<boolean> {
    // All callers check a child of an existing storage root. Listing avoids expected
    // rejected stat calls (and noisy native error logs) for absent recovery files.
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? '' : path.slice(0, slash);
    const name = path.slice(slash + 1);
    const { files } = await this.fs.readdir({ directory, path: parent });
    return files.some((file) => file.name === name);
  }
  private async removeTree(directory: Directory, path: string): Promise<void> {
    if (await this.exists(directory, path)) await this.fs.rmdir({ directory, path, recursive: true });
  }
}
