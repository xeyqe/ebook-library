import { Injectable } from '@angular/core';
import { HTTP } from '@awesome-cordova-plugins/http/ngx';
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
      const link = item.querySelector('a')?.href;
      parsedList.push({
        link,
        img: (item.previousElementSibling.querySelector('img') as HTMLImageElement)?.src,
        title: item.querySelector('a')?.textContent,
        comment: item.querySelector('.pozn.odl')?.textContent,
        dtbkId: link?.substring(link.lastIndexOf('/') + 1)
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
        if (!ar.length) ar.push({ serie: null, books: [] });
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
    if (!data.querySelector('#detail h3')) return;
    const shortStories: { title: string, link: string, lgId: string, review: string }[] = [];
    data.querySelectorAll('#detail a').forEach((a: HTMLLinkElement) => {
      const shortStory = this.getShortStoryFromLink(a);
      shortStories.push(shortStory);
    });
    return shortStories;
  }

  public async getAuthorsListCBDB(author: string): Promise<{
    link: string,
    img: string,
    name: string,
    date: string,
    cbdbId: string,
  }[]> {
    const url = `https://www.cbdb.cz/hledat?text=${author}&whisper_type=&whisper_id=&ok=%EF%80%82`;
    const data = await this._getHtml(url);
    const array = Array.from(data.querySelectorAll('#search_result_box_authors .search_graphic td'));
    const output = [];
    array.forEach(td => {
      let date = td.querySelector('.search_graphic_content')?.childNodes[4]?.textContent?.trim()?.replace('*', '') || null;
      date = date === '\n\t\t\t\t\t\t\t' ? null : date;
      const cbdbId = td.querySelector('.search_graphic_content a')?.getAttribute('href') || null;
      output.push({
        link: 'https://www.cbdb.cz/' + cbdbId,
        img: 'https://www.cbdb.cz' + td.querySelector('.search_img')?.getAttribute('src') || null,
        name: td.querySelector('.search_graphic_content a')?.textContent || null,
        date,
        cbdbId
      });
    });
    return output;
  }

  public async getCBDBBooks(title: string): Promise<{
    list?: {
      main: {
        link: string,
        title: string,
        originalTitle: string,
        img: string,
        author: string,
        cbdbId: string,
        authorCbdbId: string
      }[],
      foreign: {
        img: string,
        link: string,
        title: string,
        flag: string,
        author: string,
        cbdbId: string,
        authorCbdbId: string
      }[],
      partly: {
        img: string,
        link: string,
        title: string,
        originTitle: string,
        author: string,
        cbdbId: string,
        authorCbdbId: string
      }[]
    },
    book?: {
      serie: string,
      serieOrder: number,
      genre: string,
      ISBN: string,
      length: number,
      img: string,
      originalTitle: string,
      annotation: string,
      publisher: string,
      published: number,
      cbdbId: string;
    }
  }> {
    const url = `https://www.cbdb.cz/hledat?text=${title}&whisper_type=&whisper_id=&ok=%EF%80%82`;
    const data = await this._getHtml(url);
    console.log(data)
    if (data.querySelector('[itemprop]')) {
      return {
        book: await this.getCBDBBookDetails(url)
      };
    }

    const array = Array.from(data.querySelectorAll('#search_result_box_books .search_graphic td'));
    const main = array.map(td => {
      const aa = data.querySelectorAll('.search_graphic_content a');
      const link = (aa[0] as HTMLLinkElement)?.href || '';
      const img = data.querySelector('#author_photo img')?.getAttribute('src');
      return {
        link,
        title: aa[0]?.textContent || null,
        originalTitle: data.querySelector('.search_graphic_content div')?.textContent || null,
        img: img ? 'https://www.cbdb.cz' + img : null,
        author: aa[1]?.textContent || null,
        cbdbId: link?.replace('https://www.cbdb.cz/', ''),
        authorCbdbId: (aa[1] as HTMLLinkElement)?.href || null
      };
    });
    console.log(array)
    console.log(main)

    const foreign = Array.from(data.querySelectorAll('.search_text')[0]?.querySelectorAll('tr'))?.map(tr => {
      const _col2 = tr.querySelector('.search_col2');
      const link = _col2.querySelector('a')?.href || null;

      return {
        img: (tr.querySelector('.search_col1 img') as HTMLImageElement).src,
        link,
        title: _col2.querySelector('a')?.textContent || null,
        flag: (_col2.querySelector('.search_flag') as HTMLImageElement)?.src || null,
        author: Array.from(tr.querySelectorAll('td'))?.pop()?.querySelector('a')?.textContent || null,
        cbdbId: link?.replace('https://www.cbdb.cz/', ''),
        authorCbdbId: Array.from(tr.querySelectorAll('td'))?.pop()?.querySelector('a')?.href || null
      };
    });
    console.log(foreign)
    const partly = Array.from(data.querySelectorAll('.search_text')[1]?.querySelectorAll('tr'))?.map(tr => {
      const _col2 = tr.querySelector('.search_col2');
      const link = _col2.querySelector('a')?.href || null;

      return {
        img: (tr.querySelector('.search_col1 img') as HTMLImageElement).src,
        link,
        title: _col2?.textContent?.replace('\n', '') || null,
        originTitle: tr.querySelector('.search_col3')?.textContent || null,
        author: Array.from(tr.querySelectorAll('td'))?.pop()?.querySelector('a')?.textContent || null,
        cbdbId: link?.replace('https://www.cbdb.cz/', ''),
        authorCbdbId: Array.from(tr.querySelectorAll('td'))?.pop()?.querySelector('a')?.href || null
      };
    });
    console.log(partly)
    return { list: { main, foreign, partly }};
  }

  public async getCBDBBooksOfAuthor(cbdbId: string): Promise<{
    img: string,
    rating: string,
    title: string,
    link: string,
  }[]> {
    const url = `https://www.cbdb.cz/${cbdbId}?show=knihy`;
    const data = await this._getHtml(url);
    const output = Array.from(data.querySelectorAll('.grlist_item'))?.map(el => {
      return {
        img: el.querySelector('img') ? `https://www.cbdb.cz/${el.querySelector('img')?.getAttribute('src')}` : null,
        rating: el.querySelector('.author_book_rating_0')?.textContent || null,
        title: el.querySelector('b')?.textContent + ' ' + el.querySelector('.smaller')?.textContent,
        link: el.querySelector('b') ? `https://www.cbdb.cz/${el.querySelector('b')?.parentElement?.getAttribute('href')}` : null
      };
    });
    return output;
  }

  public async getCBDBBookDetails(link: string): Promise<{
    serie: string,
    serieOrder: number,
    genre: string,
    ISBN: string,
    length: number,
    img: string,
    originalTitle: string,
    annotation: string,
    publisher: string,
    published: number,
    cbdbId: string;
  }> {
    const data = await this._getHtml(link);
    const strong = Array.from(data.querySelectorAll('.book_info_item'))?.find(el => {
      return el.textContent?.includes('Originální název:');
    })?.querySelector('strong');
    const ofSerie = data.childNodes[0]?.textContent?.includes('. kniha v sérii');

    const book = {
      serie: ofSerie ? data.childNodes[1]?.textContent : null,
      serieOrder: ofSerie ? +data.childNodes[0]?.textContent?.replace(/[^\d]/g, '') : null,
      genre: Array.from(data.querySelectorAll('[itemprop="genre"]'))?.map(el => el?.textContent)?.join(', ') || null,
      ISBN: data.querySelector('.book_info_item [itemprop="isbn"]')?.textContent || null,
      length: +data.querySelector('.book_info_item [itemprop="numberOfPages"]')?.textContent || null,
      img: data.querySelector('#book_photo_box img') ?
        'https://www.cbdb.cz/' + data.querySelector('#book_photo_box img').getAttribute('src') :
        null,
      originalTitle: strong ? `${strong.textContent} (${strong.nextSibling?.textContent?.replace(/[^\d]+/g, '')})` : null,
      annotation: data.querySelector('#book_annotation')?.textContent || null,
      publisher: data.querySelector('.book_info_item [href*="nakladatelstvi-"]')?.textContent || null,
      published: +data.querySelector('.book_info_item [href*="nakladatelstvi-"]')
        ?.nextSibling?.textContent?.replace(/[^\d]/g, '') || null,
      cbdbId: link.substring(link.lastIndexOf('/') + 1)
    };
    return book;
  }

  public async getAuthorCBDB(cbdbId: string): Promise<{
    name: string,
    surname: string,
    birth: string,
    death: string,
    nationality: string,
    biography: string,
    img: string,
    cbdbId: string,
  }> {
    const url = `https://www.cbdb.cz/${cbdbId}`;
    const data = await this._getHtml(url);
    const _name = data.querySelector('#content [itemprop="name"]')?.textContent;
    const birth = data.querySelector('[itemprop="birthDate"]')?.textContent;
    const death = data.querySelector('[itemprop="deathDate"]')?.textContent;

    const author = {
      name: _name.substring(0, _name.lastIndexOf(' ')),
      surname: _name.substring(_name.lastIndexOf(' ') + 1),
      birth: birth?.substring(birth.lastIndexOf('.') + 1) || null,
      death: death?.substring(death.lastIndexOf('.') + 1) || null,
      nationality: data.querySelector('[itemprop="birthPlace"]')?.textContent || null,
      biography: data.querySelector('#author_lifestory')?.textContent || null,
      img: data.querySelector('#author_photo img') ?
        'https://www.cbdb.cz/' + data.querySelector('#author_photo img')?.getAttribute('src') :
        null,
      cbdbId
    };
    return author;
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
    genre: string,
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
    genre: string,
  } {
    const output = {
      title: data.querySelector('#nazev_povidky').textContent,
      originalTitle: null,
      translator: null,
      img: (data.querySelector('#pro_obal img') as HTMLImageElement)?.src || null,
      genre: null
    };
    data.querySelector('#jine_nazvy')?.childNodes?.forEach(el => {
      if (el.nodeName === '#text') {
        if (el.textContent.includes('originální název: ')) {
          output.originalTitle = el.textContent.substring('originální název: '.length);
        } else if (el.textContent.includes('originál vyšel: ')) {
          const match = el.textContent.match(/\d{4}/);
          if (match) output.originalTitle += ', ' + match[0];
        }
      }
    });
    data.querySelector('#anotace')?.childNodes?.forEach(el => {
      if (el.textContent.includes('Překlad:')) {
        el.childNodes.forEach(innerEl => {
          if (innerEl.nodeName === '#text' && innerEl.textContent.startsWith('\n● ')) {
            output.translator = innerEl.textContent.substring(3);
          }
        });
      }
    });
    const pp = Array.from(data.querySelector('#povidka_info')?.childNodes)?.filter(nd => nd.nodeName === 'P');
    const genreEl = pp.find(p => p?.textContent?.startsWith('Kategorie: '));
    output.genre = genreEl?.textContent?.substring('Kategorie: '.length) || null;

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
