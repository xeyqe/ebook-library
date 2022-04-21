import { Injectable, OnInit } from '@angular/core';
import { Zip } from '@ionic-native/zip/ngx';
import { File } from '@ionic-native/file/ngx';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

import { DirectoryService } from './directory.service';

import { METADATA, CHAPTER } from 'src/app/services/interfaces';


@Injectable({
  providedIn: 'root',
})
export class EpubService implements OnInit {
  private path2ChaptersDir: string;
  constructor(
    private dir: DirectoryService,
    private zip: Zip
  ) { }

  ngOnInit() { }

  private async getOpfNcxText(path: string, optOrNcx: string): Promise<string> {
    return new Promise((resolve, reject) => {
      Filesystem.readdir({
        directory: this.dir.dir,
        path
      }).then(items => {
        items?.files?.forEach(async file => {
          if (await this.dir.isFile(`${path}/${file}`)) {
            if (file.substring(file.lastIndexOf('.') + 1) === optOrNcx) {
              const p2c = path + '/' + file;
              this.path2ChaptersDir = p2c.substring(0, p2c.lastIndexOf('/'));
              resolve(new Promise(resol => {
                Filesystem.readFile({
                  directory: this.dir.dir,
                  path: `${path}/${file}`,
                  encoding: Encoding.UTF8
                }).then(resp => resol(resp.data));
              }));
            }
          } else {
            resolve(this.getOpfNcxText(`${path}/${file}`, 'opf'));
          }
        });
      }).catch(e => {
        console.error('getOpfNcxText failed');
        console.error(this.dir.dir)
        console.error(path)
        console.error(e);
      });
    });
  }

  private async unzipEpub(relativePath2EpubFile: string): Promise<number> {
    await Filesystem.mkdir({
      directory: this.dir.dir,
      path: 'ebook-library/epub',
    });
    const uri = await Filesystem.getUri({
      directory: this.dir.dir,
      path: '',
    });

    return this.zip.unzip(uri.uri + relativePath2EpubFile, uri.uri + '/ebook-library/epub',
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
      let ISBN: string;
      for (let i = 0; i < isbnEl.length; i++) {
        if (isbnEl[i].attributes[0].value === 'ISBN') {
          ISBN = isbnEl[i].innerHTML;
          break;
        }
      }
      const genreAr = [];
      const genreEl = xml.getElementsByTagName('dc:subject');
      for (let i = 0; i < genreEl.length; i++) {
        genreAr.push(genreEl[i].textContent);
      }
      const genre = genreAr.join(', ');

      resolve({
        annotation,
        author,
        title,
        publisher,
        published,
        ISBN,
        genre,
        imgPath,
      });
    });
  }

  private async getChapters(): Promise<CHAPTER[]> {
    const opfText = await this.getOpfNcxText('ebook-library/epub', 'opf');
    const parser = new DOMParser();
    const xml = parser.parseFromString(opfText.replace(/\s*/, ''), 'text/xml');
    const list = xml.getElementsByTagName('manifest')[0].children;

    const chapters: CHAPTER[] = [];
    Array.from(list).forEach(item => {
      if (item.attributes['media-type'].value.includes('application/xhtml')) {
        let id: string;
        if (item.attributes['idref']) {
          id = item.attributes['idref'].value;
        } else if (item.attributes['id']) {
          id = item.attributes['id'].value;
        }
        if (id) {
          let src = xml.getElementById(id).attributes['href'].value;
          src = this.path2ChaptersDir ? this.path2ChaptersDir + '/' + src : src;
          chapters.push({ id, src });
        }
      }
    });
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
    const path = relativePath2Chapter.substring(0, relativePath2Chapter.lastIndexOf('/')).split('ebook-library/epub')[1];
    const file = relativePath2Chapter.substring(relativePath2Chapter.lastIndexOf('/') + 1);
    const xml = await Filesystem.readFile({
      directory: this.dir.dir,
      path: `ebook-library/epub/${path}/${file}`,
      encoding: Encoding.UTF8
    });
    const outputText = await this.getTextFromChapter(xml.data);
    return outputText;
  }

  private prepareFolder(): Promise<void> {
    return new Promise((resolve, reject) => {
      Filesystem.readdir({
        directory: this.dir.dir,
        path: 'ebook-library'
      }).then(item => {
        if (item.files.includes('epub')) {
          Filesystem.rmdir({
            directory: this.dir.dir,
            path: 'ebook-library/epub',
            recursive: true
          }).then(() => {
            resolve();
          }).catch(e => {
            console.error(e);
            reject();
          });
        } else {
          resolve();
        }
      });
    });
  }

  public async getMetadataFromEpub(path2EpubFile: string): Promise<METADATA> {
    return new Promise(async (resolve, reject) => {
      await this.prepareFolder();

      await this.unzipEpub(path2EpubFile).then(async unziped => {
        if (unziped === 0) {
          await this.getOpfNcxText('ebook-library/epub', 'opf').then(async resp => {
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

    const unziped = await this.unzipEpub(path2EpubFile);
    if (unziped !== 0) return Promise.reject();
    await this.getOpfNcxText('ebook-library/epub', 'opf');
    const chapters = await this.getChapters();
    for (const chapter of chapters) {
      const texts = await this.getTextFromEpub(chapter.src);
      for (const text of texts) {
        if (text) {
          output.push(text);
        }
      }
    }

    return output;
  }
}
