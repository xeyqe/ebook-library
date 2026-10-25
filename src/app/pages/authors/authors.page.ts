import {
  computed,
  signal,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  AfterViewInit,
  DestroyRef,
  inject,
} from '@angular/core';
import { ToastController, InfiniteScrollCustomEvent, IonicModule, ScrollCustomEvent } from '@ionic/angular/lazy';
import { Router, RouterModule } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Encoding, Filesystem } from '@capacitor/filesystem';

import { filter, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';

import { BackupAction, BackupDialogComponent } from 'src/app/material/backup-dialog/backup-dialog.component';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { InputDialogComponent } from 'src/app/material/input-dialog/input-dialog.component';

import { BOOKSIMPLIFIED, AUTHORSIMPLIFIED } from 'src/app/services/interfaces';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BackupPasswordDialogComponent } from 'src/app/material/backup-password-dialog/backup-password-dialog.component';
import { LibraryBackupService } from 'src/app/services/library-backup.service';
import { PercentPipe } from 'src/app/pipes/percent2.pipe';

type BookFilter = 'liked' | 'started' | 'lastRead' | 'finished';
type LastListened = { id: number; type: 'speech' | 'spritz' };

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-authors',
  templateUrl: './authors.page.html',
  styleUrls: ['./authors.page.scss'],

  imports: [
    IonicModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterModule,
    PercentPipe,
  ],
})
export class AuthorsComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageSize = 10;
  private readonly authors = signal<AUTHORSIMPLIFIED[]>([]);
  protected readonly visibleAuthors = signal<AUTHORSIMPLIFIED[]>([]);
  private readonly books = signal<BOOKSIMPLIFIED[]>([]);
  protected readonly visibleBooks = signal<BOOKSIMPLIFIED[]>([]);
  protected readonly lastListened = signal<LastListened>(undefined);
  protected readonly hideCharacters = signal(false);
  protected readonly where2Search = signal<'A' | 'B'>('A');
  protected readonly selectedCharacter = signal('A');
  protected readonly imgPreLink = computed(() => this.dir.imgPreLink());
  protected readonly bookSearchBy = signal<BookFilter>('started');
  protected readonly bookFilters: BookFilter[] = ['liked', 'started', 'lastRead', 'finished'];
  protected readonly alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
  protected readonly searchQuery = signal('');
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly actionError = signal('');
  protected readonly backupMessage = signal('');
  protected readonly backup = inject(LibraryBackupService);
  protected readonly state = signal<'default' | 'animated'>('default');
  private scrollTop = 0;
  private requestId = 0;
  private entryId = 0;
  private initialization?: Promise<void>;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private visibilityTimer?: ReturnType<typeof setTimeout>;

  private readonly db = inject(DatabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastController);
  private readonly dir = inject(DirectoryService);
  private readonly fr = inject(FileReaderService);
  private readonly router = inject(Router);
  private readonly workingServ = inject(BusyService);

  protected readonly hasMoreAuthors = computed(() => {
    return this.visibleAuthors().length < this.authors().length;
  });

  protected readonly hasMoreBooks = computed(() => {
    return this.visibleBooks().length < this.books().length;
  });

  ngAfterViewInit(): void {
    if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch((error) => console.error(error));
  }

  private async initialize(): Promise<void> {
    await firstValueFrom(this.db.getDatabaseState().pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef)));
    if (this.destroyRef.destroyed) return;
    void this.fr.downloadUnknownImg().catch((error) => console.error('Unable to load the placeholder image', error));
  }

  private prepare(): Promise<void> {
    return (this.initialization ??= this.initialize().catch((error) => {
      this.initialization = undefined;
      throw error;
    }));
  }

  protected async ionViewWillEnter(): Promise<void> {
    const entry = ++this.entryId;
    this.loading.set(true);
    this.loadError.set('');
    try {
      await this.prepare();
      if (this.destroyRef.destroyed || entry !== this.entryId) return;
      const [lastListened, mode, character, bookFilter] = await Promise.all([
        this.db.getValue('as'),
        this.db.getValue('where2Search'),
        this.db.getValue('character'),
        this.db.getValue('bookSearchBy'),
      ]);
      if (this.destroyRef.destroyed || entry !== this.entryId) return;
      this.lastListened.set(this.parseLastListened(lastListened));
      this.where2Search.set(mode === 'B' ? 'B' : 'A');
      this.selectedCharacter.set(this.alphabet.includes(character) ? character : 'A');
      this.bookSearchBy.set(this.bookFilters.includes(bookFilter) ? bookFilter : 'started');
      await this.load();
    } catch (error) {
      if (!this.destroyRef.destroyed && entry === this.entryId) {
        this.loading.set(false);
        this.loadError.set('Unable to load the library. Please try again.');
        console.error(error);
      }
    }
  }

  private parseLastListened(value: unknown): LastListened | undefined {
    try {
      const result =
        typeof value === 'string' && /^\d{2,}$/.test(value)
          ? { id: Number(value.slice(0, -1)), type: Number(value.slice(-1)) ? 'spritz' : 'speech' }
          : typeof value === 'string'
            ? JSON.parse(value)
            : value;
      if (
        result &&
        Number.isInteger(Number(result.id)) &&
        Number(result.id) > 0 &&
        (result.type === 'speech' || result.type === 'spritz')
      ) {
        return { id: Number(result.id), type: result.type };
      }
    } catch {
      /* Ignore invalid saved playback preferences. */
    }
    return undefined;
  }

  private async load(): Promise<void> {
    clearTimeout(this.searchTimer);
    const request = ++this.requestId;
    const mode = this.where2Search();
    const query = this.searchQuery().trim();
    this.loading.set(true);
    this.loadError.set('');
    try {
      await this.prepare();
      if (this.destroyRef.destroyed || request !== this.requestId) return;
      if (mode === 'A') {
        const authors = await (query.length >= 3
          ? this.db.findAuthors(query)
          : this.db.loadAuthors(this.selectedCharacter()));
        if (this.destroyRef.destroyed || request !== this.requestId) return;
        this.authors.set(authors);
        this.visibleAuthors.set(authors.slice(0, this.pageSize));
      } else {
        const books = await (query.length >= 3 ? this.db.findBooks(query) : this.db.loadBooks(this.bookSearchBy()));
        if (this.destroyRef.destroyed || request !== this.requestId) return;
        this.books.set(books);
        this.visibleBooks.set(books.slice(0, this.pageSize));
      }
    } catch (error) {
      if (!this.destroyRef.destroyed && request === this.requestId) {
        this.loadError.set('Unable to load the library. Please try again.');
        console.error(error);
      }
    } finally {
      if (!this.destroyRef.destroyed && request === this.requestId) this.loading.set(false);
    }
  }

  protected async changeSelectedChar(value: string, whichOne: 'authors' | 'books'): Promise<void> {
    if (whichOne === 'authors' && this.alphabet.includes(value)) {
      this.selectedCharacter.set(value);
      void this.savePreference('character', value);
    } else if (whichOne === 'books' && this.bookFilters.includes(value as BookFilter)) {
      this.bookSearchBy.set(value as BookFilter);
      void this.savePreference('bookSearchBy', value);
    } else return;
    this.searchQuery.set('');
    await this.load();
  }

  protected async where2SearchFn(): Promise<void> {
    this.where2Search.set(this.where2Search() === 'A' ? 'B' : 'A');
    void this.savePreference('where2Search', this.where2Search());
    await this.load();
  }

  private async savePreference(key: string, value: string): Promise<void> {
    try {
      await this.db.saveValue(key, value);
    } catch (error) {
      console.error('Unable to save library preferences', error);
    }
  }

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    ++this.requestId;
    this.searchTimer = setTimeout(() => {
      void this.load();
    }, 500);
  }

  protected async onSearchClear(): Promise<void> {
    this.searchQuery.set('');
    await this.load();
  }

  protected onAuthorsIonInfinite(event: InfiniteScrollCustomEvent): void {
    this.visibleAuthors.set(this.authors().slice(0, this.visibleAuthors().length + this.pageSize));
    void event.target.complete();
  }

  protected onBooksIonInfinite(event: InfiniteScrollCustomEvent): void {
    this.visibleBooks.set(this.books().slice(0, this.visibleBooks().length + this.pageSize));
    void event.target.complete();
  }

  protected onScroll(event: ScrollCustomEvent): void {
    const top = Math.max(0, event.detail.scrollTop);
    if (top === 0 || top < this.scrollTop - 2) this.state.set('default');
    else if (top > this.scrollTop + 2) this.state.set('animated');
    this.scrollTop = top;
  }

  protected onGetImgSrc(img: string): string {
    const source = img || '/ebook-library/unknown.jpg';
    return source.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink() + source) : source;
  }

  protected onGo2Last(): void {
    if (this.lastListened())
      void this.router.navigate(['/tts', this.lastListened().id, { type: this.lastListened().type }]);
  }

  protected onSearchClicked(input: HTMLInputElement, event: Event): void {
    if (!this.hideCharacters()) {
      input.focus();
      return;
    }
    input.blur();
    input.value = '';
    void this.onSearchClear();
    event.stopPropagation();
  }

  protected onToggleCharVisibility(hide: boolean): void {
    clearTimeout(this.visibilityTimer);
    this.visibilityTimer = setTimeout(() => {
      this.hideCharacters.set(hide);
    });
  }

  protected ionViewWillLeave(): void {
    ++this.requestId;
    ++this.entryId;
    clearTimeout(this.searchTimer);
    clearTimeout(this.visibilityTimer);
    this.hideCharacters.set(false);
  }

  private async choose(data: { header?: string; message?: string; selects: string[] }): Promise<number | undefined> {
    if (this.destroyRef.destroyed) return undefined;
    return firstValueFrom(
      this.dialog
        .open<DialogComponent, typeof data, number>(DialogComponent, { data })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
  }

  private async runOperation(operation: () => Promise<void>): Promise<void> {
    if (this.destroyRef.destroyed) return;
    this.actionError.set('');
    this.workingServ.busy();
    try {
      await operation();
    } catch (error) {
      if (!this.destroyRef.destroyed) this.actionError.set('The operation failed. Please try again.');
      console.error(error);
    } finally {
      this.workingServ.done();
    }
  }

  protected async onBackup(): Promise<void> {
    if (this.workingServ.working()) return;
    this.actionError.set('');
    this.backupMessage.set('');
    const selection = await firstValueFrom(
      this.dialog
        .open<BackupDialogComponent, { zipAvailable: boolean }, BackupAction>(BackupDialogComponent, {
          data: { zipAvailable: this.backup.available },
          width: '520px',
          maxWidth: '95vw',
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
    if (this.destroyRef.destroyed || this.workingServ.working()) return;
    if (selection === 'export-json') await this.runOperation(() => this.exportDB());
    else if (selection === 'import-json') await this.runOperation(() => this.selectWhat2Import());
    else if (this.backup.available && (selection === 'save-zip' || selection === 'restore-zip')) {
      await this.runLibraryBackup(selection === 'restore-zip');
    }
  }

  private async runLibraryBackup(restoring: boolean): Promise<void> {
    if (this.workingServ.isSpeaking()) {
      this.actionError.set('Stop reading before backing up or restoring the library.');
      return;
    }
    const password = await firstValueFrom(
      this.dialog
        .open<BackupPasswordDialogComponent, { restoring: boolean }, string>(BackupPasswordDialogComponent, {
          data: { restoring },
          width: '440px',
          maxWidth: '95vw',
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
    if (!password || this.destroyRef.destroyed) return;
    this.workingServ.busy();
    try {
      const completed = await (restoring ? this.backup.load(password) : this.backup.save(password));
      if (completed && !this.destroyRef.destroyed) {
        if (restoring) {
          // Saved navigation may reference IDs belonging to the replaced library.
          this.lastListened.set(undefined);
          await this.db
            .saveValue('as', null)
            .catch((error) => console.error('Unable to clear playback navigation', error));
          await this.onSearchClear();
        }
        const message = restoring ? 'Library restored.' : 'Encrypted backup saved.';
        this.backupMessage.set(message);
        await this.notifyBackup(message, false);
      }
    } catch (error) {
      const message = error?.message || 'Unable to complete the library backup operation.';
      if (!this.destroyRef.destroyed) this.actionError.set(message);
      await this.notifyBackup(message, true);
    } finally {
      this.workingServ.done();
    }
  }

  private async notifyBackup(message: string, failed: boolean): Promise<void> {
    try {
      const toast = await this.toast.create({
        header: failed ? 'Library backup failed' : 'Library backup',
        message,
        color: failed ? 'danger' : 'success',
        position: 'top',
        duration: failed ? 0 : 3500,
        buttons: ['OK'],
      });
      await toast.present();
    } catch (error) {
      console.error('Unable to show backup notification', error);
    }
  }

  private async exportDB(): Promise<void> {
    const json = await this.db.exportDB();
    const version = await this.db.getVersion();
    await this.fr.write2File(JSON.stringify(json), version);
  }

  private async selectWhat2Import(): Promise<void> {
    const files = await this.fr.getDBJsons();
    if (!files.length) {
      this.actionError.set('No database backups found.');
      return;
    }
    // Release the busy overlay while the user chooses a backup.
    this.workingServ.done();
    const selected = await this.choose({
      message: 'Choose a file to import.',
      selects: files.map((file) => file.name),
    });
    if (selected === undefined || !files[selected] || this.destroyRef.destroyed) return;
    this.workingServ.busy();
    const json = await Filesystem.readFile({
      directory: this.dir.dir,
      path: `/ebook-library/${files[selected].name}`,
      encoding: Encoding.UTF8,
    });
    await this.exportDB();
    if (this.destroyRef.destroyed) return;
    await this.db.importDB(json.data as string);
    await this.onSearchClear();
  }

  protected async onAddAuthor(): Promise<void> {
    const response = await firstValueFrom(
      this.dialog
        .open<InputDialogComponent, { header: string }, { name?: string; surname: string }>(InputDialogComponent, {
          data: { header: 'Add new author' },
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef)),
      { defaultValue: undefined },
    );
    if (!response?.surname?.trim() || this.destroyRef.destroyed) return;
    await this.runOperation(async () => {
      const path = await this.fr.getUniquePath(
        `/ebook-library/${response.surname.trim()}, ${(response.name || '').trim()}/`,
      );
      if (this.destroyRef.destroyed) return;
      await Filesystem.mkdir({ directory: this.dir.dir, path, recursive: true });
      const authorId = await this.db.addAuthor({ ...response, path });
      if (!this.destroyRef.destroyed) await this.router.navigate(['/author', authorId]);
    });
  }

  ngOnDestroy(): void {
    this.ionViewWillLeave();
    this.workingServ.done();
  }
}
