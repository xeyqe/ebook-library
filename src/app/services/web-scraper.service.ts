import { Injectable } from '@angular/core';
import { HTTP } from '@ionic-native/http/ngx';


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
      output.pseudonym = Array.from(data.querySelectorAll('.norm strong')).map(dt => dt.textContent).join(', ');
    }
    return output;
  }


  private async _getList(url: string): Promise<{
    link: string,
    img: string,
    title: string,
    comment: string,
  }[]> {
    const response = await this._getHtml(url);
    const list = response.querySelectorAll('#left_less > p.new:not(#main_search_word)');
    const parsedList = [];
    list.forEach(item => {
      parsedList.push({
        link: (item.children[0] as HTMLLinkElement).href,
        img: (item.children[0].firstChild as HTMLImageElement).src,
        title: item.children[2].innerHTML,
        comment: item.children[4].innerHTML
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
  }[] {
    const parsedList = [];
    const list = doc.querySelectorAll('#tabcontent .new2');
    list.forEach(item => {
      parsedList.push({
        link: item.querySelector('a').href,
        img: (item.previousElementSibling.querySelector('img') as HTMLImageElement).src,
        title: item.querySelector('a').textContent,
        comment: item.querySelector('.pozn.odl').textContent
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
      const link = (item.firstElementChild.firstElementChild as HTMLImageElement).style.backgroundImage;
      parsedList.push({
        name: (item.firstElementChild as HTMLElement).innerText,
        link: (item.firstElementChild as HTMLLinkElement).href,
        year: item.children[2].innerHTML,
        img: link.substring(5, link.length - 2),

      });
    });
    return parsedList;
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
