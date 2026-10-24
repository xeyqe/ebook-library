import {
  signal,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IonicModule } from '@ionic/angular/lazy';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BusyService } from 'src/app/services/busy.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { ONLINEAUTHORLINK } from 'src/app/services/interfaces';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { AUTHOR_FIELDS, AuthorDataSelection, AuthorForm } from '../author-form';

type OnlineAuthor = ONLINEAUTHORLINK & { surname?: string };

@Component({
  selector: 'app-author-online-search',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './author-online-search.component.html',
  styleUrl: './author-online-search.component.scss',
  imports: [IonicModule],
})
export class AuthorOnlineSearchComponent {
  readonly form = input.required<AuthorForm>();
  readonly dataSelected = output<AuthorDataSelection>();
  protected readonly onlineAuthors = signal<OnlineAuthor[]>([]);
  protected readonly legieAuthors = signal<OnlineAuthor[]>([]);
  protected readonly cbdbAuthors = signal<Awaited<ReturnType<WebScraperService['getAuthorsListCBDB']>>>([]);
  private readonly webScraper = inject(WebScraperService);
  private readonly workingServ = inject(BusyService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private chooseDialog(data: { message: string; selects: string[] }): Promise<number | undefined> {
    return firstValueFrom(
      this.dialog.open(DialogComponent, { data }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
  }

  async search(): Promise<void> {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    const { name, surname } = this.form().getRawValue();
    const authorName = name?.length >= 3 ? `${name} ${surname || ''}` : surname;
    const selected = await this.chooseDialog({
      message: 'Choose a source.',
      selects: ['CZ databaze knih', 'CZ legie', 'CZ cbdb'],
    });
    if (selected == null) return;
    await this.withBusy(async () => {
      switch (selected) {
        case 0:
          this.onlineAuthors.set((await this.webScraper.getAuthorsList(authorName)) || []);
          break;
        case 1: {
          const data = await this.webScraper.getAuthorsListLegie(authorName);
          if (this.destroyRef.destroyed) return;
          if (Array.isArray(data)) this.legieAuthors.set(data);
          else if (data)
            this.dataSelected.emit({
              data,
              fields: ['name', 'surname', 'pseudonym', 'nationality', 'birth', 'death', 'img', 'biography', 'lgId'],
            });
          break;
        }
        case 2:
          this.cbdbAuthors.set((await this.webScraper.getAuthorsListCBDB(authorName)) || []);
          break;
      }
      afterNextRender(
        () => {
          if (!this.destroyRef.destroyed)
            this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        },
        { injector: this.injector },
      );
    });
  }

  protected async onDownloadAuthorInfo(item: OnlineAuthor): Promise<void> {
    if (!item.dtbkId && !item.lgId) return;
    await this.withBusy(async () => {
      const data = item.dtbkId
        ? await this.webScraper.getAuthor(item.link)
        : await this.webScraper.getLegieAuthor(item.link);
      if (data && !this.destroyRef.destroyed) {
        const fields = item.dtbkId ? AUTHOR_FIELDS.filter((key) => key !== 'lgId') : AUTHOR_FIELDS;
        this.dataSelected.emit({ data, fields });
      }
    });
  }

  protected async onDownloadAuthorInfoCBDB(cbdbId: string): Promise<void> {
    await this.withBusy(async () => {
      const data = await this.webScraper.getAuthorCBDB(cbdbId);
      if (data && !this.destroyRef.destroyed) this.dataSelected.emit({ data });
    });
  }

  private async withBusy(operation: () => Promise<void>): Promise<void> {
    this.workingServ.busy();
    try {
      await operation();
    } catch (error) {
      console.error('Author operation failed', error);
    } finally {
      this.workingServ.done();
    }
  }
}
