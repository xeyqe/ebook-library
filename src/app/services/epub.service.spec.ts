import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Directory } from '@capacitor/filesystem';
import { DirectoryService } from './directory.service';
import { EPUB_FILESYSTEM, EPUB_ZIP, EpubService } from './epub.service';

const opf = `<package xmlns="http://www.idpf.org/2007/opf" xmlns:d="http://purl.org/dc/elements/1.1/">
  <metadata><d:title>Example</d:title><d:creator>Author</d:creator><d:date>invalid</d:date>
  <d:identifier id="isbn">urn:isbn:123</d:identifier></metadata>
  <manifest><item id="second" href="second.xhtml" media-type="application/xhtml+xml"/>
  <item id="first" href="chapters/first%20chapter.xhtml" media-type="application/xhtml+xml"/>
  <item id="cover" href="images/cover.jpg" media-type="image/jpeg"/></manifest>
  <spine><itemref idref="first"/><itemref idref="second"/></spine></package>`;

describe('EpubService', () => {
  let service: EpubService;
  const fs = { readdir: vi.fn(), readFile: vi.fn(), mkdir: vi.fn(), rmdir: vi.fn(), getUri: vi.fn() };
  const zip = { extractAll: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    fs.readdir.mockImplementation(async ({ path }) => ({
      files: path === 'epub' ? [{ name: 'book.opf', type: 'file' }] : [],
    }));
    fs.getUri.mockImplementation(async ({ directory, path }) => ({
      uri: directory === Directory.Cache ? `file:///cache/${path}` : 'file:///storage/',
    }));
    fs.readFile.mockImplementation(async ({ path }) => ({
      data: path.endsWith('.opf')
        ? opf
        : `<html><body><p>${path.includes('first') ? 'First' : 'Second'} &amp; text.</p><script>ignored</script></body></html>`,
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: EPUB_FILESYSTEM, useValue: fs },
        { provide: EPUB_ZIP, useValue: zip },
        { provide: DirectoryService, useValue: { dir: Directory.ExternalStorage } },
      ],
    });
    service = TestBed.inject(EpubService);
  });

  it('reads namespace-independent metadata and normalizes cover paths and invalid dates', async () => {
    await expect(service.getMetadataFromEpub('/ebook-library/book.epub')).resolves.toMatchObject({
      title: 'Example',
      author: 'Author',
      ISBN: '123',
      published: null,
      imgPaths: ['file:///cache/epub/images/cover.jpg'],
    });
    expect(zip.extractAll).toHaveBeenCalledWith({
      zipFilePath: 'file:///storage/ebook-library/book.epub',
      destDirectory: 'file:///cache/epub',
    });
  });

  it('follows spine order, decodes paths and reads entities without script content', async () => {
    await expect(service.getText('book.epub')).resolves.toEqual(['First & text.', 'Second & text.']);
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.objectContaining({ directory: Directory.Cache, path: 'epub/chapters/first chapter.xhtml' }),
    );
  });

  it('replaces previous extraction only in the app cache and reads all resources there', async () => {
    fs.readdir.mockImplementation(async ({ path }) => ({
      files:
        path === ''
          ? [{ name: 'epub', type: 'directory' }]
          : path === 'epub'
            ? [{ name: 'book.opf', type: 'file' }]
            : [],
    }));
    await service.getText('/ebook-library/book.epub');
    expect(fs.rmdir).toHaveBeenCalledExactlyOnceWith({ directory: Directory.Cache, path: 'epub', recursive: true });
    expect(fs.mkdir).toHaveBeenCalledExactlyOnceWith({ directory: Directory.Cache, path: 'epub', recursive: true });
    for (const mock of [fs.readdir, fs.readFile]) {
      expect(mock.mock.calls.every(([options]) => options.directory === Directory.Cache)).toBe(true);
    }
  });

  it('rejects resource paths escaping the cache extraction folder', async () => {
    fs.readFile.mockResolvedValue({ data: opf.replace('images/cover.jpg', '../outside.jpg') });
    await expect(service.getMetadataFromEpub('book.epub')).rejects.toThrow('outside the extraction folder');
  });

  it('rejects missing package documents instead of leaving the promise pending', async () => {
    fs.readdir.mockResolvedValue({ files: [] });
    await expect(service.getMetadataFromEpub('book.epub')).rejects.toThrow('package document');
  });

  it('rejects extraction failures and allows a later request to proceed', async () => {
    zip.extractAll.mockRejectedValueOnce(new Error('Corrupt archive'));
    await expect(service.getText('bad.epub')).rejects.toThrow('Corrupt archive');
    await expect(service.getText('good.epub')).resolves.toHaveLength(2);
  });

  it('serializes concurrent extraction and reading', async () => {
    let release: () => void;
    zip.extractAll.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = service.getText('one.epub');
    const second = service.getText('two.epub');
    await vi.waitFor(() => expect(zip.extractAll).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    expect(zip.extractAll).toHaveBeenCalledTimes(2);
  });

  it('rejects a failed chapter instead of returning a partially read book', async () => {
    fs.readFile.mockImplementation(async ({ path }) => {
      if (path.endsWith('second.xhtml')) throw new Error('Chapter unreadable');
      return { data: path.endsWith('.opf') ? opf : '<html><body>First.</body></html>' };
    });
    await expect(service.getText('book.epub')).rejects.toThrow('Chapter unreadable');
  });

  it('uses the package declared by container.xml', async () => {
    fs.readdir.mockImplementation(async ({ path }) => ({
      files:
        path === 'epub'
          ? [{ name: 'META-INF', type: 'directory' }]
          : path.endsWith('META-INF')
            ? [{ name: 'container.xml', type: 'file' }]
            : [],
    }));
    fs.readFile.mockImplementation(async ({ path }) => ({
      data: path.endsWith('container.xml')
        ? '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'
        : opf,
    }));
    await expect(service.getMetadataFromEpub('book.epub')).resolves.toMatchObject({
      title: 'Example',
      imgPaths: ['file:///cache/epub/OPS/images/cover.jpg'],
    });
  });
});
