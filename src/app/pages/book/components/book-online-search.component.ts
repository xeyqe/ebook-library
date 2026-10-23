import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { IonicModule } from '@ionic/angular/lazy';
import { MatDialog } from '@angular/material/dialog';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BOOK, AUTHOR, ONLINEBOOKLINK, ONLINEAUTHORLEGIE } from 'src/app/services/interfaces';
import { DatabaseService } from 'src/app/services/database.service';
import { BusyService } from 'src/app/services/busy.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { BookService } from '../book.service';
import { BookBrowserService } from '../book-browser.service';
import { BOOK_METADATA_FIELDS, CBDB_FIELDS, BookDataSelection, BookForm } from '../book-form';
type BookLink = ONLINEBOOKLINK | ONLINEAUTHORLEGIE['books'][number];
@Component({
  selector: 'app-book-online-search',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './book-online-search.component.html',
  styleUrl: './book-online-search.component.scss',
  imports: [IonicModule],
  providers: [InAppBrowser, BookBrowserService],
})
export class BookOnlineSearchComponent implements OnInit, OnDestroy {
  readonly form = input.required<BookForm>();
  readonly book = input.required<BOOK>();
  readonly dataSelected = output<BookDataSelection>();
  protected onlineBookList: ONLINEBOOKLINK[] = [];
  protected onlineAllBooksList: ONLINEBOOKLINK[] = [];
  protected onlineBookListLegie: ONLINEAUTHORLEGIE[] = [];
  protected onlineShortStoriesListLegie: Awaited<ReturnType<WebScraperService['getShortStoriesOfAuthorLegie']>> = [];
  protected onlineBookListCBDB: Awaited<ReturnType<WebScraperService['getCBDBBooks']>>['list'];
  protected onlineBookListOfAuthorCBDB: Awaited<ReturnType<WebScraperService['getCBDBBooksOfAuthor']>> = [];
  protected readonly cbdbGroups = ['main', 'foreign', 'partly'] as const;
  private readonly db = inject(DatabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly webScrapper = inject(WebScraperService);
  private readonly workingServ = inject(BusyService);
  private readonly cache = inject(BookService);
  private readonly browser = inject(BookBrowserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  ngOnInit(): void {
    const cached = this.cache.onlineData?.[this.book().creatorIds[0]];
    if (cached) Object.assign(this, cached);
  }
  async search(): Promise<void> {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    const selected = await firstValueFrom(
      this.dialog
        .open(DialogComponent, {
          data: { message: 'Choose a source.', selects: ['CZ databaze knih', 'CZ legie', 'CZ cbdb'] },
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
    if (selected == null) return;
    await this.withBusy(async () => {
      const author = await this.db.getAuthor(this.book().creatorIds[0]);
      if (!author || this.destroyRef.destroyed) return;
      switch (selected) {
        case 0:
          await this.getBooksList(author);
          break;
        case 1:
          await this.getBooksListLegie(author);
          break;
        case 2:
          await this.getBooksListCBDB(author);
          break;
      }
      afterNextRender(
        () => {
          if (!this.destroyRef.destroyed)
            this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        { injector: this.injector },
      );
    });
  }
  private async getBooksList(author: AUTHOR): Promise<void> {
    const name = [author.name || '', author.surname || ''].join(' ').trim();
    if (!name) return;
    const data: ONLINEBOOKLINK[] = await this.webScrapper.getBooksListOfAnyAuthor(this.form().controls.title.value);
    if (author.dtbkId) {
      this.onlineAllBooksList = await this.webScrapper.getBooksListOfAuthorById(author.dtbkId);
      this.onlineBookList = data.filter((book) => this.onlineAllBooksList.some((other) => other.link === book.link));
    } else {
      this.onlineBookList = data.filter((book) => book.comment?.includes(author.surname));
      if (!this.onlineBookList.length && !author.pseudonym)
        this.onlineBookList = await this.webScrapper.getBooksListOfAuthor(name);
      this.onlineBookList.push(...data);
    }
  }
  private async getBooksListLegie(author: AUTHOR): Promise<void> {
    const name = [author.name || '', author.surname || ''].join(' ').trim();
    const data = await this.webScrapper.getBookByNameLegie(name, this.form().controls.title.value);
    if (!data) return;
    if (Array.isArray(data)) {
      if (!data.length && author.lgId) {
        this.onlineBookListLegie = await this.webScrapper.getBooksOfAuthorLegie(author.lgId);
        this.onlineShortStoriesListLegie = await this.webScrapper.getShortStoriesOfAuthorLegie(author.lgId);
      } else this.onlineBookList = data;
    } else this.select({ data, fields: BOOK_METADATA_FIELDS });
  }
  private async getBooksListCBDB(author: AUTHOR): Promise<void> {
    const data = await this.webScrapper.getCBDBBooks(this.book().title);
    if (data.list) this.onlineBookListCBDB = data.list;
    else if (data.book) this.select({ data: data.book, fields: CBDB_FIELDS, clearMissing: true });
    if (author.cbdbId) this.onlineBookListOfAuthorCBDB = await this.webScrapper.getCBDBBooksOfAuthor(author.cbdbId);
  }
  protected async downloadBookInfo(item: BookLink): Promise<void> {
    if (!navigator.onLine) {
      alert('Not connected to internet!');
      return;
    }
    await this.withBusy(async () => {
      if ('dtbkId' in item && item.dtbkId) {
        const data = await this.browser.read(item.link);
        if (!data) return;
        const noise = '...celý text';
        const annotation = String(data.annotation || '');
        data.annotation = annotation.endsWith(noise) ? annotation.slice(0, -noise.length) : data.annotation;
        data.language = data.language && data.language !== 'český' ? null : 'cs-CZ';
        data.genre = data.genre?.toString();
        data.dtbkId = item.dtbkId;
        this.select({ data, fields: [...BOOK_METADATA_FIELDS, 'dtbkId'] });
      } else if (item.lgId) {
        const data = await this.webScrapper.getBookLegie(item.link);
        this.select({ data: { ...data, lgId: item.lgId }, fields: [...BOOK_METADATA_FIELDS, 'lgId'] });
      }
    });
  }
  protected async downloadShortStoryInfo(item: { link: string }): Promise<void> {
    await this.withBusy(async () => {
      this.select({ data: await this.webScrapper.getShortStoryLegie(item.link) });
    });
  }
  protected async downloadBookInfoCBDB(link: string): Promise<void> {
    await this.withBusy(async () => {
      this.select({ data: await this.webScrapper.getCBDBBookDetails(link), fields: CBDB_FIELDS, clearMissing: true });
    });
  }
  private select(selection: BookDataSelection): void {
    if (!this.destroyRef.destroyed) this.dataSelected.emit(selection);
  }
  private async withBusy(operation: () => Promise<void>): Promise<void> {
    this.workingServ.busy();
    try {
      await operation();
    } catch (error) {
      console.error('Book lookup failed', error);
    } finally {
      this.workingServ.done();
    }
  }
  ngOnDestroy(): void {
    this.cache.onlineData = {
      [this.book().creatorIds[0]]: {
        onlineAllBooksList: this.onlineAllBooksList,
        onlineBookListLegie: this.onlineBookListLegie,
        onlineShortStoriesListLegie: this.onlineShortStoriesListLegie,
      },
    };
  }
}
