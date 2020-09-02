import { Injectable, OnInit } from '@angular/core';
import { Zip } from '@ionic-native/zip/ngx';
import { File, Entry } from '@ionic-native/file/ngx';
import { METADATA, CHAPTER } from 'src/app/services/interfaces.service';


@Injectable({
  providedIn: 'root',
})
export class EpubService implements OnInit {
  private path2ChaptersDir: string;
  constructor(private zip: Zip, private file: File) { }

  ngOnInit() { }

  private async getOpfNcxText(path: string, optOrNcx: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const directory = path.substring(path.lastIndexOf('/') + 1);
      path = path.substring(0, path.lastIndexOf('/'));
      this.file.listDir(path, directory).then(entries => {

        for (const entry of entries as Entry[]) {
          if (entry.isFile && entry.name.substring(entry.name.lastIndexOf('.') + 1) === optOrNcx) {
            this.path2ChaptersDir = this.getRootPath().slice(0, -1) +
              entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/'));
            resolve(this.file.readAsText(
              this.path2ChaptersDir,
              entry.name
            ));
          }
          if (entry.isDirectory) {
            const path2 = this.getRootPath().slice(0, -1) + entry.fullPath.slice(0, -1);
            resolve(this.getOpfNcxText(path2, 'opf'));
          }
        }
      });
    });

  }

  private async unzipEpub(relativePath2EpubFile: string): Promise<number> {
    const rootPath = this.getRootPath();
    const path = rootPath + 'ebook-library/';
    const folder = 'epub';
    await this.file.createDir(path, folder, true);
    return this.zip.unzip(rootPath + relativePath2EpubFile, path + folder,
      (progress) => console.log('Unzipping, ' + Math.round((progress.loaded / progress.total) * 100) + '%')
    );
  }

  private getMetadata(opfText: string): Promise<METADATA> {
    return new Promise((resolve, reject) => {
      if (!opfText) {
        return;
      }
      const parser = new DOMParser();
      const xml = parser.parseFromString(opfText, 'text/xml');
      let imgPath: string;

      try {
        const id = xml.getElementsByTagName('metadata')[0].querySelector('[name="cover"]').getAttribute('content');
        imgPath = this.path2ChaptersDir + '/' + xml.querySelector('#' + id).getAttribute('href');
      } catch {
        const elms = xml.querySelectorAll('[id*="cover"]');
        for (const el of Array.from(elms)) {
          if (el.getAttribute('media-type').match('^image/')) {
            imgPath = this.path2ChaptersDir + '/' + el.getAttribute('href');
          }
        }

      }

      const annotation = xml.getElementsByTagName('dc:description').length
        ? xml.getElementsByTagName('dc:description')[0].textContent
        : null;
      const author = xml.getElementsByTagName('dc:creator').length
        ? xml.getElementsByTagName('dc:creator')[0].textContent
        : null;
      const title = xml.getElementsByTagName('dc:title').length
        ? xml.getElementsByTagName('dc:title')[0].textContent
        : null;
      const publisher = xml.getElementsByTagName('dc:publisher').length
        ? xml.getElementsByTagName('dc:publisher')[0].textContent
        : null;
      const published = xml.getElementsByTagName('dc:date').length
        ? new Date(xml.getElementsByTagName('dc:date')[0].textContent).getFullYear()
        : null;

      const isbnEl = xml.getElementsByTagName('dc:identifier');
      let isbn: string;
      for (let i = 0; i < isbnEl.length; i++) {
        if (isbnEl[i].attributes[0].value === 'ISBN') {
          isbn = isbnEl[i].innerHTML;
          break;
        }
      }
      const genre = [];
      const genreEl = xml.getElementsByTagName('dc:subject');
      for (let i = 0; i < genreEl.length; i++) {
        genre.push(genreEl[i].textContent);
      }

      resolve({
        annotation,
        author,
        title,
        publisher,
        published,
        isbn,
        genre,
        imgPath,
      });
    });
  }

  private async getChapters(): Promise<CHAPTER[]> {
    const opfText = await this.getOpfNcxText(this.getRootPath() + 'ebook-library/epub', 'opf');
    const parser = new DOMParser();
    const xml = parser.parseFromString(opfText, 'text/xml');
    const list = xml.getElementsByTagName('manifest')[0].children;
    const chapters: CHAPTER[] = [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].attributes['media-type'].value.includes('application/xhtml')) {
        let id: string;
        if (list[i].attributes['idref']) {

          id = list[i].attributes['idref'].value;
        } else if (list[i].attributes['id']) {
          id = list[i].attributes['id'].value;
        }
        if (id) {
          let src = xml.getElementById(id).attributes['href'].value;
          src = this.path2ChaptersDir ? this.path2ChaptersDir + '/' + src : src;
          chapters.push({ id, src });
        }
      }
    }
    return chapters;
  }

  private getTextFromChapter(chapterHtmlText: string): Promise<string[]> {
    return new Promise((resolve) => {
      const parser = new DOMParser();
      const xml = parser.parseFromString(chapterHtmlText, 'text/xml');

      const texts = xml
        .querySelector('body')
        .innerHTML.replace(/<\/p>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .split('\n')
        .filter((item) => {
          if (item.trim().length) {
            return item;
          }
        });
      resolve(texts);
    });
  }

  private async getTextFromEpub(relativePath2Chapter: string): Promise<string[]> {
    const path = relativePath2Chapter.substring(0, relativePath2Chapter.lastIndexOf('/'));
    const file = relativePath2Chapter.substring(relativePath2Chapter.lastIndexOf('/') + 1);
    const xml = await this.file
      .readAsText(path, file);
    const outputText = await this.getTextFromChapter(xml);
    return outputText;
  }

  private prepareFolder(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.file
        .removeRecursively(this.getRootPath() + 'ebook-library', 'epub')
        .then(() => {
          console.log('removed');
          resolve();
        }).catch(e => {
          console.log(e);
          e.code === 1 ? resolve() : reject();
        });
    });
  }

  public getRootPath(): string {
    return this.file.externalRootDirectory;
  }

  public async getMetadataFromEpub(path2EpubFile: string): Promise<METADATA> {
    return new Promise(async (resolve, reject) => {
      await this.prepareFolder();

      await this.unzipEpub(path2EpubFile).then(async unziped => {
        if (unziped === 0) {
          await this.getOpfNcxText(this.getRootPath() + 'ebook-library/epub', 'opf').then(async resp => {
            this.getMetadata(resp).then(metadata => {
              resolve(metadata);
            });
          });
        }
      });
    });
  }

  public async getText(path2EpubFile: string): Promise<string[]> {
    const output: string[] = [];
    await this.prepareFolder();

    await this.unzipEpub(path2EpubFile).then(async unziped => {
      if (unziped === 0) {
        await this.getOpfNcxText(this.getRootPath() + 'ebook-library/epub', 'opf').then(async resp => {
          await this.getChapters().then(async chapters => {
            for (const chapter of chapters) {
              await this.getTextFromEpub(chapter.src).then(async texts => {
                if (texts && (texts as string[]).length) {
                  for (const text of texts as string[]) {
                    if (text) {
                      output.push(text);
                    }
                  }
                }
              });
            }
          });
        });
      }
    });
    return output;
  }
}
