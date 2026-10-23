import { DestroyRef, inject, Injectable } from '@angular/core';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { Subscription } from 'rxjs';
import { BookData } from './book-form';
@Injectable()
export class BookBrowserService {
  private readonly browser = inject(InAppBrowser);
  private readonly destroyRef = inject(DestroyRef);
  read(url: string): Promise<BookData> {
    return new Promise((resolve, reject) => {
      const browser = this.browser.create(url, '_blank', 'location=yes,hidden=false,beforeload=yes');
      const subscriptions = new Subscription();
      let completed = false;
      let unregister = () => {};
      const finish = (data?: BookData, error?: unknown) => {
        if (completed) return;
        completed = true;
        subscriptions.unsubscribe();
        unregister();
        browser.close();
        if (error) reject(error);
        else resolve(data);
      };
      unregister = this.destroyRef.onDestroy(() => finish(undefined, new Error('Book lookup was cancelled.')));
      subscriptions.add(browser.on('exit').subscribe(() => finish()));
      subscriptions.add(
        browser.on('message').subscribe((event) => {
          const data = event.data;
          if (data.length) data.length = Number(data.length);
          if (data.genre) data.genre = data.genre.replace(/ , /g, ', ');
          if (data.serie) data.serie = data.serie.trim();
          if (data.serieOrder) data.serieOrder = Number(String(data.serieOrder).replace(/[^\d]/g, ''));
          if (data.originalTitle) data.originalTitle = data.originalTitle.trim();
          finish(data);
        }),
      );
      subscriptions.add(
        browser.on('loadstop').subscribe(() => {
          void browser
            .executeScript({
              code: `
                document.querySelector('.show_hide_more')?.click();
                document.querySelector('#moreBookDetails > a')?.click();
                setTimeout(() => {
                  const categories = Array.from(document.querySelectorAll('.category'));
                  const category = label => categories.find(item => item.textContent === label);
                  const book = {
                    annotation: document.querySelector('.new2.odtop')?.textContent,
                    genre: Array.from(document.querySelectorAll('.genre')).map(item => item.textContent).join(', '),
                    img: document.querySelector('.kniha_img')?.src,
                    language: category('Jazyk vydání:')?.nextElementSibling?.innerText,
                    originalTitle: category('Originální název:')?.nextSibling?.textContent?.trim(),
                    length: document.querySelector('[itemprop=numberOfPages]')?.innerText,
                    published: category('Vydáno:')?.nextElementSibling?.textContent,
                    publisher: document.querySelector('[href*=nakladatelstvi]')?.innerText,
                    title: document.querySelector('.oddown_five')?.innerText?.replace(' přehled', ''),
                    translator: document.querySelector('[itemprop=translator]')?.innerText,
                    ISBN: categories.find(item => item.textContent.includes('ISBN'))?.nextElementSibling?.innerText,
                    serie: document.querySelector('[itemprop=bookEdition]')?.innerText,
                    serieOrder: document.querySelector('[itemprop=bookEdition]')?.nextElementSibling?.textContent,
                  };
                  webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(book));
                }, 1000);
              `,
            })
            .catch((error) => finish(undefined, error));
        }),
      );
    });
  }
}
