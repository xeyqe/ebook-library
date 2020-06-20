import { Injectable, OnInit } from '@angular/core';
import { Zip } from '@ionic-native/zip/ngx';
import { File, Entry } from '@ionic-native/file/ngx';
import { METADATA, CHAPTER } from 'src/app/services/interfaces.service';

@Injectable({
  providedIn: 'root',
})
export class EpubService implements OnInit {
  constructor(private zip: Zip, private file: File) { }

  ngOnInit() { }

  private async getOpfNcxText(optOrNcx: string): Promise<string> {
    try {
      const entries = await this.file
        .listDir(this.file.externalRootDirectory + 'ebook-library', 'epub');
      for (const entry of entries as Entry[]) {
        if (entry.isFile && entry.name.substring(entry.name.lastIndexOf('.') + 1) === optOrNcx) {
          return this.file.readAsText(
            this.file.externalRootDirectory.slice(0, -1) +
            entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/')),
            entry.name
          );
        }
      }
    }
    catch (e) {
      console.log('getOpfNcxText failed in checkDir');
      console.log(e);
      return null;
    }
  }

  async unzipEpub(pathWhat: string): Promise<number> {
    const rootPath = this.file.externalRootDirectory;
    const path = rootPath + 'ebook-library/';
    const folder = 'epub';

    await this.file.createDir(path, folder, true);
    return this.zip.unzip(rootPath + pathWhat, path + folder,
      (progress) => console.log('Unzipping, ' + Math.round((progress.loaded / progress.total) * 100) + '%')
    );
  }

  private getMetadata(): Promise<METADATA> {
    return new Promise((resolve) => {
      this.getOpfNcxText('opf')
        .then((opfText) => {
          if (!opfText) {
            return;
          }
          const parser = new DOMParser();
          const xml = parser.parseFromString(opfText, 'text/xml');

          const imgEl = xml.getElementById('cover');
          let imgPath: string = null;

          if (
            imgEl &&
            imgEl.getAttribute('media-type') &&
            imgEl.getAttribute('media-type').match('^image/') &&
            imgEl.getAttribute('href')
          ) {
            imgPath = this.file.externalRootDirectory + 'ebook-library/epub/' + imgEl.getAttribute('href');
          }

          const annotation = xml.getElementsByTagName('dc:description')
            ? xml.getElementsByTagName('dc:description')[0].textContent
            : null;
          const author = xml.getElementsByTagName('dc:creator')
            ? xml.getElementsByTagName('dc:creator')[0].textContent
            : null;
          const title = xml.getElementsByTagName('dc:title')
            ? xml.getElementsByTagName('dc:title')[0].textContent
            : null;
          const publisher = xml.getElementsByTagName('dc:publisher')
            ? xml.getElementsByTagName('dc:publisher')[0].textContent
            : null;
          const published = xml.getElementsByTagName('dc:date')
            ? new Date(xml.getElementsByTagName('dc:date')[0].textContent)
            : null;

          const _isbn = xml.getElementsByTagName('dc:identifier');
          let isbn: string;
          for (let i = 0; i < _isbn.length; i++) {
            if (_isbn[i].attributes[0].value === 'ISBN') {
              isbn = _isbn[i].innerHTML;
              break;
            }
          }
          const genre = [];
          const _genre = xml.getElementsByTagName('dc:subject');
          for (let i = 0; i < _genre.length; i++) {
            genre.push(_genre[i].textContent);
          }
          resolve({
            annotation,
            author,
            title,
            publisher,
            published: published.getFullYear(),
            isbn,
            genre,
            imgPath,
          });
        })
        .catch((e) => {
          console.log(e);
        });
    });
  }

  async getChapters(): Promise<CHAPTER[]> {
    const opfText = await this.getOpfNcxText('opf');
    const parser = new DOMParser();
    const xml = parser.parseFromString(opfText, 'text/xml');
    const _list = xml.getElementsByTagName('itemref');
    const chapters:CHAPTER[] = [];
    for (let i = 0; i < _list.length; i++) {
      const id = _list[i].attributes['idref'].value;
      const src = xml.getElementById(id).attributes['href'].value;
      chapters.push({ id, src });
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

  async getTextFromEpub(path2Epub: string, path2Chapter: string): Promise<string[]> {
    path2Epub = this.file.externalRootDirectory + path2Epub;
    const xml = await this.file
      .readAsText(this.file.externalRootDirectory + 'ebook-library/' + 'epub', path2Chapter);
    const outputText = await this.getTextFromChapter(xml);
    return outputText;
  }

  getEpubMetadata(path: string): Promise<METADATA> {
    return new Promise((resolve, reject) => {
      this.prepareFolder().then(() => {
        this.unzipEpub(path)
          .then((num) => {
            if (num === 0) {
              this.getMetadata()
                .then((metadata) => {
                  resolve(metadata);
                })
                .catch((e) => {
                  console.log(e);
                  reject();
                });
            } else {
              reject();
            }
          })
          .catch((e) => {
            console.log('epub.service getEpubMetadata failed: ');
            console.log(e);
            reject(e);
          });
      });
    });
  }

  private prepareFolder(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.file
        .checkDir(this.file.externalRootDirectory + 'ebook-library', 'epub')
        .then(() => {
          this.file
            .removeRecursively(this.file.externalRootDirectory + 'ebook-library', 'epub')
            .then(() => {
              resolve();
            });
        })
        .catch((e) => {
          if (e.code === 1) {
            resolve();
          } else {
            reject();
          }
        });
    });
  }
}
