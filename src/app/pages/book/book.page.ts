import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BOOK } from 'src/app/services/interfaces';
import { DatabaseService } from 'src/app/services/database.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { BusyService } from 'src/app/services/busy.service';
import { EpubService } from 'src/app/services/epub.service';
import { NonusedPicsService } from '../author/nonused-pics.service';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import {
  BOOK_FIELDS,
  BookDataSelection,
  BookField,
  BookValues,
  bookFormValues,
  createBookForm,
  createBookSuggestions,
} from './book-form';
import { BookDetailsComponent } from './components/book-details.component';
import { LibraryPictureComponent } from 'src/app/components/library-picture/library-picture.component';
import { BookOnlineSearchComponent } from './components/book-online-search.component';
@Component({
  selector: 'app-book',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './book.page.html',
  styleUrl: './book.page.scss',
  imports: [
    IonicModule,
    MatButtonModule,
    MatIconModule,
    BookDetailsComponent,
    LibraryPictureComponent,
    BookOnlineSearchComponent,
  ],
})
export class BookComponent implements OnInit, OnDestroy {
  private readonly db = inject(DatabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly fs = inject(FileReaderService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly epub = inject(EpubService);
  private readonly picsServ = inject(NonusedPicsService);
  private readonly workingServ = inject(BusyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly picture = viewChild(LibraryPictureComponent);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  protected readonly onlineSearch = viewChild(BookOnlineSearchComponent);
  protected readonly bookForm = createBookForm();
  protected suggestions = createBookSuggestions();
  protected book: BOOK = null;
  protected bookChanged = false;
  protected readonly isEditing = signal(false);
  protected readonly showOnlineSearch = inject(WebScraperService).showAble;

  ngOnInit(): void {
    this.bookForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => (this.bookChanged = true));
    for (const key of ['serie', 'title', 'originalTitle', 'genre'] as const) {
      this.bookForm.controls[key].valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
        const normalized = value?.replace(/\n/g, '');
        if (value !== normalized) this.bookForm.controls[key].setValue(normalized, { emitEvent: false });
      });
    }
  }
  async ionViewDidEnter(): Promise<void> {
    try {
      const params = await firstValueFrom(this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)));
      await firstValueFrom(this.db.getDatabaseState().pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef)));
      const book = await this.db.getBook(Number(params.get('id')));
      if (this.destroyRef.destroyed) return;
      if (!book) throw new Error('Book was not found.');
      const img = book.img;
      if (
        img?.startsWith('http://localhost/_app_file_/storage') ||
        img?.startsWith('http://localhost/_capacitor_file_/')
      ) {
        book.img = img.replace(/.*\/ebook-library/, '/ebook-library');
        await this.db.updateBook(book);
      }
      if (this.destroyRef.destroyed) return;
      this.book = book;
      this.suggestions = createBookSuggestions();
      for (const key of BOOK_FIELDS) this.addSuggestion(key, book[key]);
      this.suggestions.img = [...new Set([...this.suggestions.img, ...(this.picsServ.pics || [])])];
      this.bookForm.reset(bookFormValues(book), { emitEvent: false });
      this.bookForm.disable({ emitEvent: false });
      this.isEditing.set(false);
      this.bookChanged = false;
    } catch (error) {
      console.error('Unable to load book', error);
    }
  }
  protected async updateBook(): Promise<void> {
    if (!this.book || !this.isEditing()) return;
    try {
      const picture = this.picture();
      const img = picture ? await picture.prepareImageForSave() : this.bookForm.controls.img.value;
      this.bookForm.controls.img.setValue(img);
      const values = this.bookForm.getRawValue();
      const updated: BOOK = { ...this.book, ...values, progress: this.book.progress };
      await this.db.updateBook(updated);
      if (this.destroyRef.destroyed) return;
      this.book = updated;
      this.bookForm.disable({ emitEvent: false });
      this.bookChanged = false;
      this.isEditing.set(false);
    } catch (error) {
      console.error('Unable to save book', error);
    }
  }
  protected editable(): void {
    if (!this.book) return;
    this.isEditing.update((editing) => !editing);
    if (this.isEditing()) this.bookForm.enable({ emitEvent: false });
    else {
      this.bookForm.reset(bookFormValues(this.book), { emitEvent: false });
      this.bookForm.disable({ emitEvent: false });
    }
    this.bookChanged = false;
  }
  protected onOnlineData(selection: BookDataSelection): void {
    const fields = selection.fields ?? BOOK_FIELDS;
    const values = Object.fromEntries(
      fields
        .filter((key) => selection.clearMissing || (selection.data[key] != null && selection.data[key] !== ''))
        .map((key) => [key, selection.data[key] ?? null]),
    ) as Partial<BookValues>;
    this.bookForm.patchValue(values);
    for (const key of fields) this.addSuggestion(key, values[key]);
    if (selection.images?.length) {
      this.suggestions.img = selection.images;
      this.bookForm.controls.img.setValue(selection.images[0]);
    }
    this.scrollToContent();
  }
  private addSuggestion<Key extends BookField>(key: Key, value: BookValues[Key]): void {
    if (value != null && value !== '' && !this.suggestions[key].includes(value)) this.suggestions[key].push(value);
  }
  protected async getMetadataFromEpub(): Promise<void> {
    if (!this.book) return;
    this.workingServ.busy();
    try {
      const metadata = await this.epub.getMetadataFromEpub(this.book.path);
      if (!metadata || this.destroyRef.destroyed) return;
      this.onOnlineData({
        data: { ...metadata, annotation: metadata.annotation?.replace(/<[^>]*>/g, '') || null },
        fields: ['annotation', 'ISBN', 'title', 'published', 'publisher', 'genre'],
        images: metadata.imgPaths,
      });
    } catch (error) {
      console.error('Unable to read EPUB metadata', error);
    } finally {
      this.workingServ.done();
    }
  }
  protected async deleteBook(): Promise<void> {
    if (!this.book) return;
    const selected = await firstValueFrom(
      this.dialog
        .open(DialogComponent, {
          data: { message: 'Do you really want to delete this book?', selects: ['Ok', 'Cancel'] },
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
    if (selected !== 0) return;
    try {
      await this.removeBookFile();
      await this.db.deleteBook(this.book.id);
      if (!this.destroyRef.destroyed) await this.router.navigate(['/author', this.book.creatorIds[0]]);
    } catch (error) {
      console.error('Unable to delete book', error);
    }
  }
  private async removeBookFile(): Promise<void> {
    const path = this.book.path.replace(/.*ebook-library/, '/ebook-library');
    try {
      if (await this.db.isBookFileUsedInDifferentBook(path, this.book.id)) return;
    } catch (error) {
      console.error('Unable to check book file usage', error);
      return;
    }
    try {
      await this.fs.removeFile(path);
    } catch (error) {
      console.error('Unable to remove book file', error);
      if (!this.destroyRef.destroyed)
        this.dialog.open(DialogComponent, {
          data: { header: 'Warning', message: 'Deleting of book file failed!', selects: ['Ok'] },
        });
    }
  }
  protected onGo2(mode: 'spritz' | 'speech'): void {
    if (this.book) void this.router.navigate(['/tts', this.book.id, { type: mode }]);
  }
  protected scrollToContent(): void {
    if (!this.destroyRef.destroyed)
      this.content()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
  }
  ngOnDestroy(): void {
    this.workingServ.done();
  }
}
