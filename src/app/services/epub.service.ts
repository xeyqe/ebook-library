import { inject, Injectable, InjectionToken } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Zip4J } from 'capacitor-zip4j';
import { DirectoryService } from './directory.service';
import { METADATA } from './interfaces';

export const EPUB_FILESYSTEM = new InjectionToken<
  Pick<typeof Filesystem, 'readdir' | 'readFile' | 'mkdir' | 'rmdir' | 'getUri'>
>('EPUB filesystem', {
  providedIn: 'root',
  factory: () => ({
    readdir: (options) => Filesystem.readdir(options),
    readFile: (options) => Filesystem.readFile(options),
    mkdir: (options) => Filesystem.mkdir(options),
    rmdir: (options) => Filesystem.rmdir(options),
    getUri: (options) => Filesystem.getUri(options),
  }),
});
export const EPUB_ZIP = new InjectionToken<Pick<typeof Zip4J, 'extractAll'>>('EPUB extractor', {
  providedIn: 'root',
  factory: () => ({ extractAll: (options) => Zip4J.extractAll(options) }),
});

@Injectable({ providedIn: 'root' })
export class EpubService {
  private readonly dir = inject(DirectoryService);
  private readonly filesystem = inject(EPUB_FILESYSTEM);
  private readonly zip = inject(EPUB_ZIP);
  private readonly folder = 'epub';
  private operation: Promise<unknown> = Promise.resolve();

  // Extraction uses one shared folder; keep complete reads together, including failures.
  private queue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.operation.then(operation);
    this.operation = pending.catch(() => {});
    return pending;
  }

  private async read(path: string): Promise<string> {
    const result = await this.filesystem.readFile({ directory: Directory.Cache, path, encoding: Encoding.UTF8 });
    if (typeof result.data !== 'string') throw new Error(`Unable to read EPUB file: ${path}`);
    return result.data;
  }

  private parse(text: string): Document {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid EPUB XML.');
    return xml;
  }

  private elements(xml: Document, name: string): Element[] {
    return Array.from(xml.getElementsByTagNameNS('*', name));
  }

  private resolvePath(base: string, href: string): string {
    const parts = base.split('/');
    const relative = decodeURIComponent(href.split(/[?#]/)[0]);
    if (/^[a-z][a-z\d+.-]*:/i.test(relative) || relative.startsWith('/'))
      throw new Error('Invalid EPUB resource path.');
    for (const part of relative.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (parts.length <= this.folder.split('/').length)
          throw new Error('EPUB resource is outside the extraction folder.');
        parts.pop();
      } else parts.push(part);
    }
    return parts.join('/');
  }

  private async findOpf(path: string): Promise<string | undefined> {
    const { files } = await this.filesystem.readdir({ directory: Directory.Cache, path });
    const opf = files.find((file) => file.type === 'file' && /\.opf$/i.test(file.name));
    if (opf) return `${path}/${opf.name}`;
    for (const file of files) {
      if (file.type !== 'directory') continue;
      const found = await this.findOpf(`${path}/${file.name}`);
      if (found) return found;
    }
    return undefined;
  }

  private async extract(path: string): Promise<{ xml: Document; base: string }> {
    const { files } = await this.filesystem.readdir({ directory: Directory.Cache, path: '' });
    if (files.some((file) => file.type === 'directory' && file.name === 'epub')) {
      await this.filesystem.rmdir({ directory: Directory.Cache, path: this.folder, recursive: true });
    }
    await this.filesystem.mkdir({ directory: Directory.Cache, path: this.folder, recursive: true });
    const [{ uri }, { uri: destination }] = await Promise.all([
      this.filesystem.getUri({ directory: this.dir.dir, path: '' }),
      this.filesystem.getUri({ directory: Directory.Cache, path: this.folder }),
    ]);
    const root = uri.replace(/\/+$/, '');
    await this.zip.extractAll({
      zipFilePath: `${root}/${path.replace(/^\/+/, '')}`,
      destDirectory: destination,
    });

    const { files: rootFiles } = await this.filesystem.readdir({ directory: Directory.Cache, path: this.folder });
    let opfPath: string | undefined;
    if (rootFiles.some((file) => file.name === 'META-INF' && file.type === 'directory')) {
      const { files: metadataFiles } = await this.filesystem.readdir({
        directory: Directory.Cache,
        path: `${this.folder}/META-INF`,
      });
      if (metadataFiles.some((file) => file.name === 'container.xml')) {
        const container = this.parse(await this.read(`${this.folder}/META-INF/container.xml`));
        const rootfile = this.elements(container, 'rootfile')[0]?.getAttribute('full-path');
        if (!rootfile) throw new Error('EPUB container has no package document.');
        opfPath = this.resolvePath(this.folder, rootfile);
      }
    }
    opfPath ??= await this.findOpf(this.folder);
    if (!opfPath) throw new Error('EPUB package document was not found.');
    return { xml: this.parse(await this.read(opfPath)), base: opfPath.slice(0, opfPath.lastIndexOf('/')) };
  }

  getMetadataFromEpub(path: string): Promise<METADATA> {
    return this.queue(async () => {
      const { xml, base } = await this.extract(path);
      const text = (name: string) => this.elements(xml, name)[0]?.textContent?.trim() || null;
      const year = text('date') ? new Date(text('date')).getFullYear() : NaN;
      const identifier = this.elements(xml, 'identifier').find(
        (element) =>
          Array.from(element.attributes).some(
            (attribute) => attribute.localName === 'scheme' && attribute.value.toUpperCase() === 'ISBN',
          ) || /^urn:isbn:/i.test(element.textContent.trim()),
      );
      return {
        annotation: text('description'),
        author: text('creator'),
        title: text('title'),
        publisher: text('publisher'),
        published: Number.isFinite(year) ? year : null,
        ISBN: identifier?.textContent?.trim().replace(/^urn:isbn:/i, '') || null,
        genre: this.elements(xml, 'subject')
          .map((element) => element.textContent.trim())
          .filter(Boolean)
          .join(', '),
        imgPaths: await Promise.all(
          this.elements(xml, 'item')
            .filter((item) => item.getAttribute('media-type')?.startsWith('image/') && item.hasAttribute('href'))
            .map(async (item) => {
              const { uri } = await this.filesystem.getUri({
                directory: Directory.Cache,
                path: this.resolvePath(base, item.getAttribute('href')),
              });
              return uri;
            }),
        ),
      };
    });
  }

  getText(path: string): Promise<string[]> {
    return this.queue(async () => {
      const { xml, base } = await this.extract(path);
      const manifest = new Map(this.elements(xml, 'item').map((item) => [item.getAttribute('id'), item]));
      const spine = this.elements(xml, 'itemref');
      if (!spine.length) throw new Error('EPUB has no reading order.');
      const output: string[] = [];
      for (const reference of spine) {
        if (reference.getAttribute('linear') === 'no') continue;
        const item = manifest.get(reference.getAttribute('idref'));
        if (!item?.getAttribute('href')) throw new Error('EPUB reading order references a missing chapter.');
        if (!['application/xhtml+xml', 'text/html'].includes(item.getAttribute('media-type'))) continue;
        const html = new DOMParser().parseFromString(
          await this.read(this.resolvePath(base, item.getAttribute('href'))),
          'text/html',
        );
        html.querySelectorAll('script, style').forEach((element) => element.remove());
        html
          .querySelectorAll('p, div, section, h1, h2, h3, h4, h5, h6, li, br')
          .forEach((element) => element.append(' '));
        const text = html.body.textContent.replace(/\s+/g, ' ').trim();
        const sentences = text.split(/(?<=[.!?])\s+|(?<=[.!?][”"’'])\s+/);
        output.push(...sentences.map((sentence) => sentence.trim()).filter(Boolean));
      }
      return output;
    });
  }
}
