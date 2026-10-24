import { inject, Injectable, InjectionToken } from '@angular/core';
import { Filesystem, Encoding, FileInfo } from '@capacitor/filesystem';
import { DirectoryService } from './directory.service';
import { DatabaseService } from './database.service';
import { AUTHOR, BOOK } from './interfaces';

export const FILE_READER_FILESYSTEM = new InjectionToken<
  Pick<typeof Filesystem, 'readdir' | 'mkdir' | 'downloadFile' | 'readFile' | 'writeFile' | 'deleteFile'>
>('File reader filesystem', {
  providedIn: 'root',
  factory: () => ({
    readdir: (options) => Filesystem.readdir(options),
    mkdir: (options) => Filesystem.mkdir(options),
    downloadFile: (options) => Filesystem.downloadFile(options),
    readFile: (options) => Filesystem.readFile(options),
    writeFile: (options) => Filesystem.writeFile(options),
    deleteFile: (options) => Filesystem.deleteFile(options),
  }),
});

@Injectable({ providedIn: 'root' })
export class FileReaderService {
  private readonly filesystem = inject(FILE_READER_FILESYSTEM);
  private readonly db = inject(DatabaseService);
  private readonly dir = inject(DirectoryService);
  private authorScan?: Promise<void>;
  private readonly bookScans = new Map<number, Promise<void>>();

  get ready2addAuthors(): boolean {
    return !this.authorScan;
  }
  get ready2addBooks(): boolean {
    return this.bookScans.size === 0;
  }

  async createEbookLibraryFolder(): Promise<void> {
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: '' });
    if (!files.some((file) => file.name === 'ebook-library' && file.type === 'directory')) {
      await this.filesystem.mkdir({ directory: this.dir.dir, path: 'ebook-library', recursive: true });
    }
  }

  async createApplicationFolder(): Promise<void> {
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: '' });
    if (files.some((file) => file.name === 'ebook-library' && file.type === 'directory')) return;
    await this.filesystem.mkdir({ directory: this.dir.dir, path: 'ebook-library/Wilde, Oscar', recursive: true });
    await this.downloadDorian();
  }

  async downloadDorian(): Promise<void> {
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: 'ebook-library' });
    if (!files.some((file) => file.name === 'Wilde, Oscar' && file.type === 'directory')) {
      await this.filesystem.mkdir({ directory: this.dir.dir, path: 'ebook-library/Wilde, Oscar', recursive: true });
    }
    await this.ensureDownload(
      'ebook-library/Wilde, Oscar/The Picture of Dorian Gray.epub',
      'https://www.gutenberg.org/ebooks/174.epub',
    );
  }

  private async ensureDownload(path: string, url: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf('/'));
    const name = path.slice(path.lastIndexOf('/') + 1);
    // Listing distinguishes a missing file from permission and storage failures.
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: parent });
    if (files.some((file) => file.type === 'file' && file.name === name)) return;
    await this.filesystem.downloadFile({ directory: this.dir.dir, path, url });
  }

  listOfAuthors(): Promise<void> {
    if (this.authorScan) return this.authorScan;
    this.authorScan = this.scanAuthors().finally(() => {
      this.authorScan = undefined;
    });
    return this.authorScan;
  }

  private async scanAuthors(): Promise<void> {
    const paths = await this.db.allAuthorsPaths();
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: 'ebook-library' });
    for (const folder of files) {
      if (folder.type === 'directory' && folder.name !== 'epub') await this.addAuthor(paths, folder);
    }
  }

  private async addAuthor(paths: string[], folder: FileInfo): Promise<void> {
    const path = `/ebook-library/${folder.name}`;
    if (paths.some((existing) => existing?.replace(/\/+$/, '') === path)) return;
    const [surname, ...names] = folder.name.split(',');
    const authorId = await this.db.addAuthor(
      this.createAuthor({ surname: surname.trim(), forename: names.join(',').trim(), path }),
    );
    await this.addBooksOfAuthor(authorId, path);
  }

  private createAuthor(dt: { forename: string; surname: string; path: string }): AUTHOR {
    return {
      id: null,
      name: dt.forename,
      surname: dt.surname,
      pseudonym: null,
      nationality: null,
      birth: null,
      death: null,
      biography: null,
      img: null,
      rating: null,
      path: dt.path,
      idInJson: null,
      dtbkId: null,
      lgId: null,
      cbdbId: null,
      booksIds: null,
    };
  }

  addBooksOfAuthor(authorId: number, path: string): Promise<void> {
    if (!path) return Promise.resolve();
    const existing = this.bookScans.get(authorId);
    if (existing) return existing;
    const scan = this.scanBooks(authorId, path).finally(() => {
      this.bookScans.delete(authorId);
    });
    this.bookScans.set(authorId, scan);
    return scan;
  }

  private async scanBooks(authorId: number, path: string): Promise<void> {
    const paths = new Set(await this.db.authorsBooksPaths(authorId));
    await this.booksOfAuthor(path, authorId, paths);
  }

  private async booksOfAuthor(path: string, authorId: number, paths: Set<string>): Promise<void> {
    const folder = path.replace(/\/+$/, '');
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: folder });
    for (const file of files) {
      const fullPath = `${folder}/${file.name}`;
      if (file.type === 'directory') await this.booksOfAuthor(fullPath, authorId, paths);
      else if (file.type === 'file' && /\.(txt|epub|pdf)$/i.test(file.name) && !paths.has(fullPath)) {
        const title = file.name.slice(0, file.name.lastIndexOf('.'));
        await this.db.addBook(this.createBook({ title, creatorIds: [authorId], path: fullPath }));
        paths.add(fullPath);
      }
    }
  }

  async getNonBookFilesOfFolder(path: string): Promise<string[]> {
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path });
    return files
      .filter((file) => file.type === 'file' && !/\.(txt|epub|pdf)$/i.test(file.name))
      .map((file) => `${path.replace(/\/+$/, '')}/${file.name}`);
  }

  private createBook(dt: { title: string; creatorIds: number[]; path: string }): BOOK {
    return {
      id: null,
      title: dt.title,
      creatorIds: dt.creatorIds,
      originalTitle: null,
      annotation: null,
      publisher: null,
      published: null,
      genre: null,
      length: null,
      language: 'cs-CZ',
      translator: null,
      ISBN: null,
      path: dt.path,
      progress: null,
      rating: null,
      img: null,
      serie: null,
      serieOrder: null,
      dtbkId: null,
      lgId: null,
      cbdbId: null,
      added: new Date(),
      lastRead: null,
      finished: null,
    };
  }

  async readTextFile(path: string): Promise<string> {
    const { data } = await this.filesystem.readFile({ directory: this.dir.dir, path, encoding: Encoding.UTF8 });
    if (typeof data !== 'string') throw new Error(`Unable to read text file: ${path}`);
    return data;
  }

  async downloadPicture(url: string, path: string, fileName: string): Promise<string> {
    const name = fileName.replace(/[,:\s/\\]/g, '_');
    if (!name || name === '.' || name === '..') throw new Error('Invalid picture filename.');
    const filePath = `/${path.replace(/^\/+|\/+$/g, '')}/${name}`;
    await this.ensureDownload(filePath, url);
    return filePath;
  }

  async removeFile(path: string): Promise<void> {
    await this.filesystem.deleteFile({ directory: this.dir.dir, path });
  }

  async write2File(text: string, dbVersion: number): Promise<void> {
    const path = `/ebook-library/db${dbVersion}_${new Date().toJSON().replace(/[,:\s/]/g, '_')}.json`;
    await this.filesystem.writeFile({ directory: this.dir.dir, path, data: text, encoding: Encoding.UTF8 });
  }

  async getDBJsons(): Promise<FileInfo[]> {
    const { files } = await this.filesystem.readdir({ directory: this.dir.dir, path: 'ebook-library' });
    return files.filter((file) => file.type === 'file' && /^db.*\.json$/i.test(file.name));
  }

  async downloadUnknownImg(): Promise<void> {
    await this.ensureDownload(
      'ebook-library/unknown.jpg',
      'https://p1.hiclipart.com/preview/584/221/301/sword-art-online-vector-icons-help-unknown-png-icon-thumbnail.jpg',
    );
  }

  public async getUniquePath(filePath: string): Promise<string> {
    const isDirectory = filePath.endsWith('/');
    const normalizedPath = filePath.replace(/\/+$/, '');
    const separator = normalizedPath.lastIndexOf('/');
    const parentPath = separator < 0 ? '' : normalizedPath.slice(0, separator + 1);
    const name = normalizedPath.slice(separator + 1);
    const extensionIndex = isDirectory ? -1 : name.lastIndexOf('.');
    const stem = extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
    const extension = extensionIndex > 0 ? name.slice(extensionIndex) : '';
    const { files } = await this.filesystem.readdir({
      directory: this.dir.dir,
      path: parentPath || '',
    });
    const existingNames = new Set(files.map((file) => file.name));
    let candidate = name;
    let suffix = 0;
    while (existingNames.has(candidate)) {
      candidate = `${stem}${++suffix}${extension}`;
    }
    return `${parentPath}${candidate}${isDirectory ? '/' : ''}`;
  }
}
