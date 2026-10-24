import { controlValueSignal } from 'src/app/utils/control-value-signal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AUTHOR, AUTHORSBOOKS } from 'src/app/services/interfaces';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { BusyService } from 'src/app/services/busy.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { NonusedPicsService } from './nonused-pics.service';
import {
  AUTHOR_FIELDS,
  AuthorData,
  AuthorDataSelection,
  AuthorField,
  AuthorValues,
  createAuthorForm,
  createAuthorSuggestions,
} from './author-form';
import { AuthorDetailsComponent } from './components/author-details.component';
import { LibraryPictureComponent } from 'src/app/components/library-picture/library-picture.component';
import { AuthorBooksComponent, AuthorSeries } from './components/author-books.component';
import { AuthorOnlineSearchComponent } from './components/author-online-search.component';

@Component({
  selector: 'app-author',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './author.page.html',
  styleUrl: './author.page.scss',
  imports: [
    MatButtonModule,
    MatIconModule,
    AuthorDetailsComponent,
    LibraryPictureComponent,
    AuthorBooksComponent,
    AuthorOnlineSearchComponent,
  ],
})
export class AuthorComponent implements OnInit, OnDestroy {
  private readonly db = inject(DatabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly directoryServ = inject(DirectoryService);
  private readonly fs = inject(FileReaderService);
  private readonly picsServ = inject(NonusedPicsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workingServ = inject(BusyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly picture = viewChild(LibraryPictureComponent);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  protected readonly onlineSearch = viewChild(AuthorOnlineSearchComponent);
  protected readonly bookList = viewChild(AuthorBooksComponent);
  protected readonly author = signal<AUTHOR>(null);
  protected readonly books = signal<AUTHORSBOOKS[]>([]);
  protected readonly series = signal<AuthorSeries[]>([]);
  protected readonly authorChanged = signal(false);
  protected readonly isEditing = signal(false);
  protected readonly showOnlineSearch = inject(WebScraperService).showAble;
  protected readonly imgPreLink = this.directoryServ.imgPreLink;
  protected readonly authorForm = createAuthorForm();
  protected readonly formValues = controlValueSignal(this.authorForm);
  protected readonly suggestions = signal(createAuthorSuggestions());
  private initialization: Promise<void> = Promise.resolve();
  ngOnInit(): void {
    this.initialization = this.initialize().catch((error) => {
      console.error('Unable to load author', error);
      this.workingServ.done();
    });
  }

  async ionViewDidEnter(): Promise<void> {
    await this.initialization;
    if (!this.author() || this.destroyRef.destroyed) return;
    try {
      const books = (await this.db.getBooksOfAuthor(this.author().booksIds)) ?? [];
      if (this.destroyRef.destroyed) return;
      for (const book of books) book.img = this.normalizeImagePath(book.img);
      await this.groupBooksBySeries(books);
      if (this.destroyRef.destroyed) return;
      await this.loadUnusedPics([...books.map((book) => book.img), this.author().img]);
    } catch (error) {
      console.error('Unable to load author books', error);
    }
  }

  private async initialize(): Promise<void> {
    const params = await firstValueFrom(this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)));
    await firstValueFrom(this.db.getDatabaseState().pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef)));
    const author = await this.db.getAuthor(Number(params.get('id')));
    if (this.destroyRef.destroyed) return;
    if (!author) throw new Error('Author was not found.');
    this.author.set(author);
    await this.updateOldImgs(author.img);
    if (this.destroyRef.destroyed) return;
    this.initializeForm(this.author());
    await this.fs.addBooksOfAuthor(author.id, author.path);
    const refreshed = await this.db.getAuthor(author.id);
    if (!this.destroyRef.destroyed && refreshed)
      this.author.update((current) => ({ ...current, booksIds: refreshed.booksIds }));
  }

  private async updateOldImgs(img: string): Promise<void> {
    const normalized = this.normalizeImagePath(img);
    if (normalized === img) return;
    this.author.update((current) => ({ ...current, img: normalized }));
    await this.db.updateAuthor(this.author());
  }

  private normalizeImagePath(img: string): string {
    if (
      img?.startsWith('http://localhost/_app_file_/storage') ||
      img?.startsWith('http://localhost/_capacitor_file_/')
    ) {
      return img.replace(/.*\/ebook-library/, '/ebook-library');
    }
    return img;
  }

  private initializeForm(author: AUTHOR): void {
    this.applyAuthorData(author);
    this.authorForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.authorChanged.set(true);
    });
  }

  private applyAuthorData(data: AuthorData, fields: readonly AuthorField[] = AUTHOR_FIELDS): void {
    const values = Object.fromEntries(fields.map((key) => [key, data[key] ?? null])) as Partial<AuthorValues>;
    this.authorForm.patchValue(values);
    for (const key of fields) this.addSuggestion(key, values[key]);
  }

  private addSuggestion<Key extends AuthorField>(key: Key, value: AuthorValues[Key]): void {
    if (value && !this.suggestions()[key].includes(value))
      this.suggestions.update((current) => ({ ...current, [key]: [...current[key], value] }));
  }

  private async groupBooksBySeries(books: AUTHORSBOOKS[]): Promise<void> {
    const previousState = new Map(this.series().map((series) => [series.name, series.open]));
    const grouped = new Map<string, AuthorSeries>();
    this.books.set([]);
    for (const book of books) {
      if (!book.serie) {
        this.books.update((current) => [...current, book]);
        continue;
      }
      if (!grouped.has(book.serie)) {
        grouped.set(book.serie, { name: book.serie, open: previousState.get(book.serie) ?? false, books: [] });
      }
      grouped.get(book.serie).books.push(book);
    }
    if (!grouped.size) {
      this.series.set([]);
      return;
    }
    const otherBooks = await this.db.getSeriesBooks([...grouped.keys()], this.author().id);
    if (this.destroyRef.destroyed) return;
    for (const [name, books] of Object.entries(otherBooks)) grouped.get(name)?.books.push(...books);
    this.series.set([...grouped.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  private async loadUnusedPics(usedPics: string[]): Promise<void> {
    const allFiles = await this.fs.getNonBookFilesOfFolder(this.author().path);
    if (this.destroyRef.destroyed) return;
    const unused = allFiles.filter((file) => !usedPics.includes(file));
    this.suggestions.update((current) => ({ ...current, img: [...new Set([...this.suggestions().img, ...unused])] }));
    this.picsServ.pics = unused.length ? unused : null;
  }

  protected async onUpdateAuthor(): Promise<void> {
    if (!this.author() || !this.isEditing()) return;
    try {
      const img = this.picture() ? await this.picture().prepareImageForSave() : this.authorForm.controls.img.value;
      this.authorForm.controls.img.setValue(img);
      const updated = { ...this.author(), ...this.authorForm.getRawValue() };
      await this.db.updateAuthor(updated);
      if (this.destroyRef.destroyed) return;
      this.author.set(updated);
      this.authorForm.disable();
      this.authorChanged.set(false);
      this.isEditing.set(false);
    } catch (error) {
      console.error('Unable to save author', error);
    }
  }

  protected onEditable(): void {
    if (!this.author()) return;
    this.isEditing.update((editing) => !editing);
    if (this.isEditing()) {
      this.authorForm.enable();
    } else {
      this.authorForm.reset(this.author());
      this.authorForm.disable();
    }
    this.authorChanged.set(false);
  }

  protected async deleteAuthor(): Promise<void> {
    const selected = await this.chooseDialog({
      message: "Do you really want to delete this author?\n(Files won't be deleted.)",
      selects: ['Ok', 'Cancel'],
    });
    if (selected !== 0 || !this.author()) return;
    await this.db.deleteAuthor(this.author().id);
    await this.router.navigate(['/authors']);
  }

  private chooseDialog(data: { message: string; selects: string[] }): Promise<number | undefined> {
    return firstValueFrom(
      this.dialog.open(DialogComponent, { data }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
  }

  protected onOnlineData(selection: AuthorDataSelection): void {
    this.applyAuthorData(selection.data, selection.fields);
    this.scrollToContent();
  }

  protected onBookAdded(book: AUTHORSBOOKS): void {
    this.books.set([...this.books(), book]);
  }

  protected scrollToContent(): void {
    if (this.destroyRef.destroyed) return;
    this.content()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  }

  ngOnDestroy(): void {
    this.workingServ.done();
  }
}
