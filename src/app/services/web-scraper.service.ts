import { Injectable } from '@angular/core';
import { HTTP } from '@ionic-native/http/ngx';
import { ONLINEAUTHORLEGIE } from './interfaces';


@Injectable({
  providedIn: 'root'
})
export class WebScraperService {
  showAble = true;

  constructor(
    private http: HTTP,
  ) { }

  private async _getHtml(site: string) {
    const parser = new DOMParser();
    const data = await this.http.get(site, null, null);
    return parser.parseFromString(data.data, 'text/html');
  }

  public async getAuthor(url: string): Promise<{
    name: string,
    surname: string,
    nationality: string,
    birth: string,
    death: string,
    biography: string,
    img: string,
    dtbkId: string
  }> {
    const dtbkId = url.substring(url.lastIndexOf('/') + 1);

    const data = await this._getHtml(url);
    const output = {
      name: null,
      surname: null,
      pseudonym: null,
      nationality: null,
      birth: null,
      death: null,
      biography: null,
      img: null,
      dtbkId,
    };

    if (data.querySelector('.circle-avatar')) {
      output.img = (data.querySelector('.circle-avatar') as HTMLElement).style.backgroundImage;
      output.img = output.img.substring(5, output.img.length - 2);
    }
    if (data.querySelector('[itemprop="name"]')) {
      output.surname = data.querySelector('[itemprop="name"]').innerHTML;
    }
    if (output.surname.includes(' ')) {
      output.name = output.surname.substring(0, output.surname.lastIndexOf(' '));
      output.surname = output.surname.substring(output.surname.lastIndexOf(' ') + 1);
    }
    const birthDeath = (data.querySelector('.norma') as HTMLElement)?.innerText?.match(/[0-9]+/g) || null;

    if (birthDeath && birthDeath[0]) {
      output.birth = birthDeath[0];
    }
    if (birthDeath && birthDeath[1]) {
      output.death = birthDeath[1];
    }
    if (data.querySelector('.norma a')) {
      output.nationality = (data.querySelector('.norma a') as HTMLElement).innerText;
    }
    const link = (data.querySelector('#tab_cv').parentElement as HTMLLinkElement).href;
    const cv = await this._getHtml(link);
    output.biography = (cv.querySelector('.new2') as HTMLElement).innerText;
    if (data.querySelector('.norm')) {
      output.pseudonym = Array.from(data.querySelectorAll('.norm strong') || []).map(dt => dt.textContent).join(', ');
    }
    return output;
  }


  private async _getList(url: string): Promise<{
    link: string,
    img: string,
    title: string,
    comment: string,
    dtbkId: string
  }[]> {
    const response = await this._getHtml(url);
    const list = response.querySelectorAll('#left_less > p.new:not(#main_search_word)');
    const parsedList = [];
    list.forEach(item => {
      const link = (item.children[0] as HTMLLinkElement).href;
      parsedList.push({
        link,
        img: (item.children[0].firstChild as HTMLImageElement).src,
        title: item.children[2].innerHTML,
        comment: item.children[4].innerHTML,
        dtbkId: link?.substring(link.lastIndexOf('/') + 1) || null
      });
    });
    return parsedList.sort((a, b) => {
      if (a.title.toLowerCase() < b.title.toLowerCase()) {
        return -1;
      }
      if (a.title.toLowerCase() > b.title.toLowerCase()) {
        return 1;
      }
      return 0;
    });
  }

  private async _getListFromAuthorPG(url: string): Promise<{
    link: string,
    img: string,
    title: string,
    comment: string,
    dtbkId: string,
  }[]> {
    const doc = await this._getHtml(url);
    const pages = doc.querySelector('.pager')?.childElementCount || 0;
    const parsedList = this._booksFromAuthorsDoc(doc);
    for (let i = 2; i < pages + 1; i++) {
      const doc2 = await this._getHtml(`${url}?orderBy=&filtr=&id=${i}`);
      parsedList.push(...this._booksFromAuthorsDoc(doc2));
    }

    return parsedList;
  }

  private _booksFromAuthorsDoc(doc: Document): {
    link: string,
    img: string,
    title: string,
    comment: string,
    dtbkId: string,
  }[] {
    const parsedList = [];
    const list = doc.querySelectorAll('#tabcontent .new2');
    list.forEach(item => {
      const link = item.querySelector('a').href;
      parsedList.push({
        link,
        img: (item.previousElementSibling.querySelector('img') as HTMLImageElement).src,
        title: item.querySelector('a').textContent,
        comment: item.querySelector('.pozn.odl').textContent,
        dtbkId: link.substring(link.lastIndexOf('/') + 1)
      });
    });
    return parsedList;
  }

  public async getBooksListOfAuthor(authorName: string): Promise<{
    link: string;
    img: string;
    title: string;
    comment: string;
  }[]> {
    const url = `https://www.databazeknih.cz/search?q=${authorName}&sm=books`;
    const books = await this._getList(url);
    return books.filter(bk => bk.comment.includes(authorName));
  }

  public async getBooksListOfAuthorById(dtbkId: string): Promise<{
    link: string;
    img: string;
    title: string;
    comment: string;
  }[]> {
    const url = `https://www.databazeknih.cz/vydane-knihy/${dtbkId}`;
    const books = await this._getListFromAuthorPG(url);
    return books;
  }

  public getBooksListOfAnyAuthor(title: string): Promise<any> {
    const url = `https://www.databazeknih.cz/search?q=${title}&in=books`;
    return this._getList(url);
  }

  public async getAuthorsList(authorName: string): Promise<any> {
    const url = `https://www.databazeknih.cz/search?q=${authorName}&in=authors`;
    const data = await this._getHtml(url);
    const list = data.querySelectorAll('.autbox');
    const parsedList = [];
    list.forEach(item => {
      const imgLink = (item.firstElementChild.firstElementChild as HTMLImageElement).style.backgroundImage;
      const link = (item.firstElementChild as HTMLLinkElement).href;
      const dtbkId = link.substring(link.lastIndexOf('/') + 1);
      parsedList.push({
        name: (item.firstElementChild as HTMLElement).innerText,
        link,
        year: item.children[2].innerHTML,
        img: imgLink.substring(5, imgLink.length - 2),
        dtbkId
      });
    });
    return parsedList;
  }

  public async getAuthorsListLegie(authorName: string): Promise<any> {
    const url = `https://www.legie.info/index.php?cast=autori&search_text=${authorName}`;
    const data = await this._getHtml(url);
    const isUnique = !!data.querySelector('#autor_info');
    if (isUnique) {
      return this.getAuthorLegie(data);
    } else {
      return Array.from(data.querySelectorAll('.tabulka-s-okraji a') || [])?.map((a: any) => {
        const nm = a.textContent.split(',');
        const lgId = a.href.substring(a.href.lastIndexOf('/') + 1);
        return { link: a.href, name: nm[1]?.trim() || null, surname: nm[0], lgId };
      });
    }
  }

  private getAuthorLegie(data: Document): {
    img: string,
    name: string,
    surname: string,
    birth: string,
    death: string,
    nationality: string,
    biography: string,
  } {
    const output = {
      img: null,
      name: null,
      surname: null,
      birth: null,
      death: null,
      nationality: null,
      biography: null,
      lgId: null,
    };

    output.img = (data.querySelector('#foto_autor') as any)?.src || null;
    const nm = data.querySelector('#jmeno_autora').textContent;
    const indx = nm.lastIndexOf(' ');
    if (indx !== -1) {
      output.surname = nm.substring(indx + 1);
      output.name = nm.substring(0, indx);
    } else {
      output.surname = nm;
    }
    const ar = Array.from(data.querySelector('#autor_zaklad')?.children || [])?.map(item => item.textContent);
    ar.forEach(txt => {
      if (txt.startsWith('Život: ')) {
        const dates = txt.match(/\d{4}/g);
        if (dates.length) {
          output.birth = dates[0];
          output.death = dates[1] || null;
        }
      } else if (txt.startsWith('Národnost: ')) {
        output.nationality = txt.substring('Národnost: '.length);
      }
    });
    output.biography = data.querySelector('#detail').textContent;
    let lgId = (data.querySelector('#zalozky a') as HTMLLinkElement).href;
    lgId = lgId.substring(0, lgId.lastIndexOf('/'));
    lgId = lgId.substring(lgId.lastIndexOf('/') + 1);
    output.lgId = lgId;
    return output;
  }

  public async getLegieAuthor(url: string): Promise<{
    img: string,
    name: string,
    surname: string,
    birth: string,
    death: string,
    nationality: string,
    biography: string,
  }> {
    const data = await this._getHtml(url);
    return this.getAuthorLegie(data);
  }

  public async getBooksOfAuthorLegie(lgId: string): Promise<ONLINEAUTHORLEGIE[]> {
    const url = `https://www.legie.info/autor/${lgId}/knihy#zalozky`;
    const data = await this._getHtml(url);
    const ar: {
      serie: {
        title: string,
        link: string
      },
      books: {
        title: string,
        link: string,
        review: string,
        lgId: string
      }[]
    }[] = [];
    const seznamDel = Array.from(data.querySelector('.seznam_del')?.children || []);
    seznamDel.forEach(el => {
      if (el.tagName === 'DT') {
        const a = el.querySelector('a');
        if (a) {
          const serie = {
            title: a.textContent,
            link: a.href
          };
          ar.push({ serie, books: [] });
        } else {
          ar.push({ serie: null, books: [] });
        }
      } else if (el.tagName === 'DD') {
        const a = el.querySelector('a');
        const book = {
          title: a.textContent,
          link: a.href,
          review: el.lastChild.textContent,
          lgId: a.href.substring(a.href.lastIndexOf('/') + 1)
        };
        ar[ar.length - 1].books.push(book);
      }
    });
    return ar;
  }

  public async getShortStoriesOfAuthorLegie(
    lgId: string
  ): Promise<{ title: string, link: string, lgId: string, review: string }[]> {
    const url = `https://www.legie.info/autor/${lgId}/povidky#zalozky`;
    const data = await this._getHtml(url);
    const shortStories: { title: string, link: string, lgId: string, review: string }[] = [];
    data.querySelectorAll('#detail a').forEach((a: HTMLLinkElement) => {
      const shortStory = this.getShortStoryFromLink(a);
      shortStories.push(shortStory);
    });
    return shortStories;
  }

  private getShortStoryFromLink(a: HTMLLinkElement): { title: string, link: string, lgId: string, review: string } {
    const output = {
      title: a.textContent || null,
      link: a.href || null,
      lgId: a.href?.substring(a.href.lastIndexOf('/') + 1) || null,
      review: a.nextSibling.nodeName === '#text' ? a.nextSibling.textContent : null
    };
    return output;
  }

  public async getBookByNameLegie(authorsName: string, bookName: string) {
    const url = `https://www.legie.info/index.php?search_text=${bookName}&search_autor_kp=${authorsName}&search_ignorovat_casopisy=on&omezeni=ksp`;
    const data = await this._getHtml(url);
    const isUnique = !!data.querySelector('#kniha_info');
    if (isUnique) {
      return this.getBookLegieFromDoc(data);
    } else {
      return Array.from(data.querySelectorAll('.tabulka-s-okraji a') || [])?.filter(a => !a[`href`].includes('autor'))?.map((a: any) => {
        const lgId = a.href.substring(a.href.lastIndexOf('/') + 1);
        return { link: a.href, title: a.textContent, lgId };
      });
    }
  }

  public async getBookLegie(url: string) {
    const data = await this._getHtml(url);
    return this.getBookLegieFromDoc(data);
  }

  private getBookLegieFromDoc(data: Document): {
    serie: string,
    title: string,
    img: string,
    serieOrder: string,
    genre: string,
    originalTitle: string,
    publisher: string,
    published: number,
    annotation: string,
  } {
    const output = {
      serie: null,
      title: null,
      img: null,
      serieOrder: null,
      genre: null,
      originalTitle: null,
      publisher: null,
      published: null,
      annotation: null,
    };
    output.title = data.querySelector('#nazev_knihy').textContent || null;
    output.img = (data.querySelector('#pro_obal img') as HTMLImageElement)?.src || null;
    output.serie = data.querySelector('#dily_serie strong a')?.textContent || null;
    output.annotation = data.querySelector('#anotace > p')?.textContent || null;

    const pp = Array.from(data.querySelector('#nazev_knihy')?.parentElement?.querySelectorAll('p') || []);
    pp.forEach(p => {
      if (p.textContent.startsWith('série: ')) {
        p.childNodes.forEach(ch => {
          if (ch.nodeName === '#text') {
            if (ch.textContent.includes('díl v sérii: ')) {
              output.serieOrder = ch.textContent.substring(ch.textContent.lastIndexOf(' ') + 1);
            }
          }
        });
      } else if (/^Kategorie: /.test(p.textContent)) {
        const genres = [];
        p.childNodes.forEach(ch => {
          if (ch.nodeName === 'A') {
            genres.push(ch.textContent);
          }
        });
        output.genre = genres.join(', ');
      } else if (p.textContent.startsWith('originální název: ')) {
        p.childNodes.forEach(ch => {
          if (ch.nodeName === '#text') {
            if (ch.textContent.includes('originální název: ')) {
              output.originalTitle = ch.textContent.substring('originální název: '.length);
            } else if (ch.textContent.includes('originál vyšel: ')) {
              const match = ch.textContent.match(/\d{4}/);
              if (match) output.originalTitle += ', ' + match[0];
            }
          }
        });
      } else if (p.textContent.startsWith('  vydání:\n')) {
        p.childNodes.forEach(ch => {
          if (ch.nodeName === 'A') {
            if ((ch as HTMLLinkElement).href.includes('/vydavatel/')) {
              output.publisher = ch.textContent;
            } else if ((ch as HTMLLinkElement).href.includes('/rok/')) {
              output.published = +ch.textContent;
            }
          }
        });
      } else if (p.textContent.includes('kniha patří do světa: ') && !output.serie) {
        output.serie = p.querySelector('a')?.textContent || null;
      }
    });
    return output;
  }

  public async getShortStoryLegie(url: string): Promise<{
    title: string,
    originalTitle: string,
    translator: string,
    img: string,
    lgId: string,
  }> {
    const data = await this._getHtml(url);
    return { ...this.getShortStoryFromDoc(data), lgId: url.substring(url.lastIndexOf('/') + 1) };
  }

  private getShortStoryFromDoc(data: Document): {
    title: string,
    originalTitle: string,
    translator: string,
    img: string,
  } {
    const output = {
      title: data.querySelector('#nazev_povidky').textContent,
      originalTitle: null,
      translator: null,
      img: (data.querySelector('#pro_obal img') as HTMLImageElement)?.src || null
    };
    data.querySelector('#jine_nazvy').childNodes.forEach(el => {
      if (el.nodeName === '#text') {
        if (el.textContent.includes('originální název: ')) {
          output.originalTitle = el.textContent.substring('originální název: '.length);
        } else if (el.textContent.includes('originál vyšel: ')) {
          const match = el.textContent.match(/\d{4}/);
          if (match) output.originalTitle += ', ' + match[0];
        }
      }
    });
    data.querySelector('#anotace').childNodes.forEach(el => {
      if (el.textContent.includes('Překlad:')) {
        el.childNodes.forEach(innerEl => {
          if (innerEl.nodeName === '#text' && innerEl.textContent.startsWith('\n● ')) {
            output.translator = innerEl.textContent.substring(3);
          }
        });
      }
    });
    return output;
  }

  public async getBook(url: string): Promise<{
    annotation: string,
    genre: string,
    published: string,
    publisher: string,
    originalTitle: string,
    title: string,
    img: string,
  }> {
    const data = await this._getHtml(url);
    const output = {
      annotation: null,
      genre: null,
      published: null,
      publisher: null,
      originalTitle: null,
      title: null,
      img: null
    };

    const preAnnotation = data.querySelectorAll('#bdetdesc > span');
    if (preAnnotation && preAnnotation[0]) {
      output.annotation = (preAnnotation[0] as HTMLElement).innerText + (preAnnotation[1] as HTMLElement).innerText;
    }
    if (data.querySelector('[itemprop="genre"]')) {
      output.genre = (data.querySelector('[itemprop="genre"]') as HTMLElement).innerText;
    }
    if (data.querySelector('[itemprop="datePublished"]')) {
      output.published = parseInt((data.querySelector('[itemprop="datePublished"]') as HTMLElement).innerText, 10);
    }
    if (data.querySelector('[itemprop="publisher"]')) {
      output.publisher = (data.querySelector('[itemprop="publisher"]') as HTMLElement).innerText;
    }
    const orgT = data.querySelectorAll('.binfo_hard');
    if (orgT && orgT[2] && orgT[2].nextElementSibling) {
      output.originalTitle = (data.querySelectorAll('.binfo_hard')[2].nextElementSibling as HTMLElement).innerText;
    }
    if (data.querySelector('[itemprop="name"]')) {
      output.title = (data.querySelector('[itemprop="name"]') as HTMLElement).innerText;
    }
    if (data.querySelector('.kniha_img')) {
      output.img = (data.querySelector('.kniha_img') as HTMLImageElement).src;
    }
    return output;
  }
}
