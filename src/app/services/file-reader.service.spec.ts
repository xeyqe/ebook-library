import { TestBed } from '@angular/core/testing';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { Directory } from '@capacitor/filesystem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';
import { DirectoryService } from './directory.service';
import { FILE_READER_FILESYSTEM, FILE_READER_TRANSFER, FileReaderService } from './file-reader.service';

describe('FileReaderService unique paths', () => {
  const readdir = vi.fn();
  let service: FileReaderService;

  beforeEach(() => {
    readdir.mockReset().mockResolvedValue({ files: [] });
    TestBed.configureTestingModule({
      providers: [
        { provide: FILE_READER_FILESYSTEM, useValue: { readdir } },
        { provide: DirectoryService, useValue: { dir: Directory.ExternalStorage } },
        { provide: DatabaseService, useValue: {} },
        { provide: WebView, useValue: {} },
      ],
    });
    service = TestBed.inject(FileReaderService);
  });

  it('returns an unused book path by listing its parent directory', async () => {
    const path = '/ebook-library/Lukášková, Markéta/Markéta Lukášková - Losos v kaluži.epub';
    await expect(service.getUniquePath(path)).resolves.toBe(path);
    expect(readdir).toHaveBeenCalledExactlyOnceWith({
      directory: Directory.ExternalStorage,
      path: '/ebook-library/Lukášková, Markéta/',
    });
  });

  it('finds the first available suffix without overwriting existing files', async () => {
    readdir.mockResolvedValue({ files: [{ name: 'Book.epub' }, { name: 'Book1.epub' }, { name: 'Book3.epub' }] });
    await expect(service.getUniquePath('/ebook-library/Author/Book.epub')).resolves.toBe(
      '/ebook-library/Author/Book2.epub',
    );
    expect(readdir).toHaveBeenCalledTimes(1);
  });

  it('adds suffixes to directory names and retains the trailing separator', async () => {
    readdir.mockResolvedValue({ files: [{ name: 'Doe, Jane' }, { name: 'Doe, Jane1' }] });
    await expect(service.getUniquePath('/ebook-library/Doe, Jane/')).resolves.toBe('/ebook-library/Doe, Jane2/');
    expect(readdir).toHaveBeenCalledWith({ directory: Directory.ExternalStorage, path: '/ebook-library/' });
  });

  it('preserves filenames without extensions', async () => {
    readdir.mockResolvedValue({ files: [{ name: 'Book' }] });
    await expect(service.getUniquePath('Book')).resolves.toBe('Book1');
  });

  it('propagates directory access failures instead of treating them as available paths', async () => {
    const error = new Error('Permission denied');
    readdir.mockRejectedValue(error);
    await expect(service.getUniquePath('/ebook-library/Author/Book.epub')).rejects.toBe(error);
  });
});

describe('FileReaderService operations', () => {
  const fs = { readdir: vi.fn(), mkdir: vi.fn(), getUri: vi.fn(), writeFile: vi.fn() };
  const transfer = { downloadFile: vi.fn() };
  const db = { authorsBooksPaths: vi.fn(), addBook: vi.fn(), allAuthorsPaths: vi.fn(), addAuthor: vi.fn() };
  let service: FileReaderService;
  beforeEach(() => {
    vi.resetAllMocks();
    fs.readdir.mockResolvedValue({ files: [] });
    fs.getUri.mockImplementation(async ({ path }) => ({
      uri: `file:///storage/emulated/0/${path.replace(/^\/+/, '')}`,
    }));
    db.authorsBooksPaths.mockResolvedValue([]);
    db.allAuthorsPaths.mockResolvedValue([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: FILE_READER_FILESYSTEM, useValue: fs },
        { provide: FILE_READER_TRANSFER, useValue: transfer },
        { provide: DirectoryService, useValue: { dir: Directory.ExternalStorage } },
        { provide: DatabaseService, useValue: db },
      ],
    });
    service = TestBed.inject(FileReaderService);
  });

  it('completes initial folder creation and sample download', async () => {
    await service.createApplicationFolder();
    expect(fs.mkdir).toHaveBeenCalledWith(expect.objectContaining({ recursive: true }));
    expect(transfer.downloadFile).toHaveBeenCalledWith({
      path: 'file:///storage/emulated/0/ebook-library/Wilde, Oscar/The Picture of Dorian Gray.epub',
      url: 'https://www.gutenberg.org/ebooks/174.epub',
    });
  });

  it('waits for recursive imports and recognizes uppercase extensions', async () => {
    fs.readdir.mockImplementation(async ({ path }) => ({
      files: path.endsWith('/nested') ? [{ name: 'Book.EPUB', type: 'file' }] : [{ name: 'nested', type: 'directory' }],
    }));
    let release: () => void;
    db.addBook.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scan = service.addBooksOfAuthor(1, '/ebook-library/Author');
    expect(service.addBooksOfAuthor(1, '/ebook-library/Author')).toBe(scan);
    await vi.waitFor(() => expect(db.addBook).toHaveBeenCalledTimes(1));
    expect(service.ready2addBooks).toBe(false);
    release();
    await scan;
    expect(service.ready2addBooks).toBe(true);
  });

  it('releases scanning state after a failure so scans can be retried', async () => {
    fs.readdir.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(service.listOfAuthors()).rejects.toThrow('Permission denied');
    expect(service.ready2addAuthors).toBe(true);
    await expect(service.listOfAuthors()).resolves.toBeUndefined();
  });

  it('normalizes picture names consistently for cached and downloaded pictures', async () => {
    await expect(
      service.downloadPicture('https://example.test/cover', '/ebook-library/Author/', 'A, B.jpg'),
    ).resolves.toBe('/ebook-library/Author/A__B.jpg');
    fs.readdir.mockResolvedValue({ files: [{ name: 'A__B.jpg', type: 'file' }] });
    await expect(
      service.downloadPicture('https://example.test/cover', '/ebook-library/Author/', 'A, B.jpg'),
    ).resolves.toBe('/ebook-library/Author/A__B.jpg');
    expect(fs.getUri).toHaveBeenCalledExactlyOnceWith({
      directory: Directory.ExternalStorage,
      path: '/ebook-library/Author/A__B.jpg',
    });
    expect(transfer.downloadFile).toHaveBeenCalledExactlyOnceWith({
      path: 'file:///storage/emulated/0/ebook-library/Author/A__B.jpg',
      url: 'https://example.test/cover',
    });
  });

  it('propagates download and backup errors', async () => {
    transfer.downloadFile.mockRejectedValue(new Error('Download failed'));
    await expect(service.downloadPicture('url', '/ebook-library', 'cover.jpg')).rejects.toThrow('Download failed');
    fs.writeFile.mockRejectedValue(new Error('Disk full'));
    await expect(service.write2File('{}', 10)).rejects.toThrow('Disk full');
  });
  it('does not start a transfer when the destination URI cannot be resolved', async () => {
    fs.getUri.mockRejectedValue(new Error('Storage unavailable'));
    await expect(service.downloadPicture('url', '/ebook-library', 'cover.jpg')).rejects.toThrow('Storage unavailable');
    expect(transfer.downloadFile).not.toHaveBeenCalled();
  });
});
