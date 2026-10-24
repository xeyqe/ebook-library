import { TestBed } from '@angular/core/testing';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { Directory } from '@capacitor/filesystem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';
import { DirectoryService } from './directory.service';
import { FILE_READER_FILESYSTEM, FileReaderService } from './file-reader.service';

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
