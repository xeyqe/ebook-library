import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { AUTHOR, AUTHORSBOOKS } from 'src/app/services/interfaces';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { AuthorComponent } from './author.page';
import { AuthorDetailsComponent } from './components/author-details.component';
import { LibraryPictureComponent } from 'src/app/components/library-picture/library-picture.component';
import { AuthorBooksComponent } from './components/author-books.component';
import { AuthorOnlineSearchComponent } from './components/author-online-search.component';
import { NonusedPicsService } from './nonused-pics.service';

describe('AuthorComponent', () => {
  let page: any;
  let ready: BehaviorSubject<boolean>;
  let author: AUTHOR;
  let database: any;
  let files: any;
  let scraper: any;

  async function initialize() {
    ready.next(true);
    page.ngOnInit();
    await page.initialization;
  }

  beforeEach(() => {
    ready = new BehaviorSubject(false);
    author = {
      id: 42,
      name: 'Jane',
      surname: 'Doe',
      pseudonym: null,
      nationality: 'CZ',
      birth: 1900,
      death: null,
      biography: 'Biography',
      img: '/ebook-library/author.jpg',
      rating: 3,
      path: '/ebook-library/Jane/',
      idInJson: null,
      dtbkId: 'original-id',
      lgId: 'legie-id',
      cbdbId: null,
      booksIds: [7],
    };
    database = {
      getDatabaseState: () => ready.asObservable(),
      getAuthor: vi.fn().mockResolvedValue(author),
      getBooksOfAuthor: vi.fn().mockResolvedValue([]),
      getSeriesBooks: vi.fn().mockResolvedValue({}),
      updateAuthor: vi.fn().mockResolvedValue(undefined),
    };
    files = {
      addBooksOfAuthor: vi.fn(),
      getNonBookFilesOfFolder: vi.fn().mockResolvedValue([]),
      removeFile: vi.fn().mockResolvedValue(undefined),
    };
    scraper = { showAble: true, getAuthorCBDB: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: DatabaseService, useValue: database },
        { provide: FileReaderService, useValue: files },
        { provide: WebScraperService, useValue: scraper },
        { provide: DirectoryService, useValue: { imgPreLink: 'file://' } },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '42' })) } },
        provideNoopAnimations(),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        BusyService,
        NonusedPicsService,
      ],
    });
    TestBed.overrideComponent(LibraryPictureComponent, { set: { template: '', imports: [] } });
    page = TestBed.runInInjectionContext(() => new AuthorComponent());
  });

  afterEach(() => {
    page.ngOnDestroy();
    ready.complete();
    vi.restoreAllMocks();
  });

  it('waits for the database and author before loading books on entry', async () => {
    page.ngOnInit();
    const entering = page.ionViewDidEnter();
    await Promise.resolve();
    expect(database.getAuthor).not.toHaveBeenCalled();
    expect(database.getBooksOfAuthor).not.toHaveBeenCalled();
    ready.next(true);
    await entering;
    expect(database.getAuthor).toHaveBeenCalledWith(42);
    expect(database.getBooksOfAuthor).toHaveBeenCalledWith([7]);
    expect(page.authorForm.controls.name.value).toBe('Jane');
  });

  it('loads picture suggestions when the database returns no books', async () => {
    await initialize();
    database.getBooksOfAuthor.mockResolvedValue(undefined);
    files.getNonBookFilesOfFolder.mockResolvedValue(['/ebook-library/unused.jpg', author.img]);
    await page.ionViewDidEnter();
    expect(page.books).toEqual([]);
    expect(page.series).toEqual([]);
    expect(page.suggestions.img).toEqual([author.img, '/ebook-library/unused.jpg']);
  });

  it('restores saved fields and source IDs when editing is cancelled', async () => {
    await initialize();
    page.onEditable();
    page.authorForm.patchValue({ name: 'Changed', dtbkId: 'changed-id' });
    expect(page.authorChanged).toBe(true);
    page.onEditable();
    expect(page.authorForm.getRawValue()).toMatchObject({ name: 'Jane', dtbkId: 'original-id' });
    expect(page.authorForm.disabled).toBe(true);
    expect(page.authorChanged).toBe(false);
    expect(author.name).toBe('Jane');
  });

  it('keeps failed saves editable without changing the saved author', async () => {
    await initialize();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    database.updateAuthor.mockRejectedValue(new Error('Database unavailable'));
    page.onEditable();
    page.authorForm.controls.name.setValue('Changed');
    await page.onUpdateAuthor();
    expect(page.isEditing()).toBe(true);
    expect(page.authorForm.enabled).toBe(true);
    expect(page.authorForm.controls.name.value).toBe('Changed');
    expect(author.name).toBe('Jane');
  });

  it('saves all form values while retaining author fields outside the form', async () => {
    await initialize();
    page.onEditable();
    page.authorForm.controls.name.setValue('Changed');
    await page.onUpdateAuthor();
    expect(database.updateAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Changed',
        dtbkId: 'original-id',
        rating: 3,
        booksIds: [7],
      }),
    );
    expect(page.isEditing()).toBe(false);
    expect(page.authorForm.disabled).toBe(true);
    expect(page.author.name).toBe('Changed');
  });

  it('preserves expanded series and merges related books without duplication on reentry', async () => {
    await initialize();
    const book = (id: string, serie: string): AUTHORSBOOKS => ({
      id,
      serie,
      title: id,
      creatorIds: [42],
      progress: null,
      img: null,
      serieOrder: 1,
    });
    database.getBooksOfAuthor.mockResolvedValue([book('1', 'Zeta'), book('2', null), book('3', 'Alpha')]);
    database.getSeriesBooks.mockResolvedValue({ Alpha: [book('4', 'Alpha')] });
    await page.ionViewDidEnter();
    page.series[0].open = true;
    await page.ionViewDidEnter();
    expect(page.series.map((series) => series.name)).toEqual(['Alpha', 'Zeta']);
    expect(page.series[0].open).toBe(true);
    expect(page.series[0].books.map((book) => book.id)).toEqual(['3', '4']);
    expect(page.books.map((book) => book.id)).toEqual(['2']);
  });

  it('collects downloaded source ID suggestions without duplicates', async () => {
    await initialize();
    page.onEditable();
    scraper.getAuthorCBDB.mockResolvedValue({ name: 'Jane', cbdbId: 'new-id' });
    const fixture = TestBed.createComponent(AuthorOnlineSearchComponent);
    fixture.componentRef.setInput('form', page.authorForm);
    fixture.componentInstance.dataSelected.subscribe((selection) => page.onOnlineData(selection));
    await (fixture.componentInstance as any).onDownloadAuthorInfoCBDB('new-id');
    await (fixture.componentInstance as any).onDownloadAuthorInfoCBDB('new-id');
    expect(page.authorForm.controls.cbdbId.value).toBe('new-id');
    expect(page.suggestions.cbdbId).toEqual(['new-id']);
  });

  it('connects the extracted editors, online results and books to the page state', async () => {
    ready.next(true);
    const fixture = TestBed.createComponent(AuthorComponent);
    const component = fixture.componentInstance as any;
    vi.spyOn(component, 'scrollToContent').mockImplementation(() => {});
    fixture.detectChanges();
    await component.initialization;
    fixture.detectChanges();
    component.onEditable();
    fixture.detectChanges();

    const details = fixture.debugElement.query(By.directive(AuthorDetailsComponent)).componentInstance;
    expect(details.form()).toBe(component.authorForm);
    details.onInput('name', 'Edited');
    expect(component.authorForm.controls.name.value).toBe('Edited');
    expect(component.authorChanged).toBe(true);

    const search = fixture.debugElement.query(By.directive(AuthorOnlineSearchComponent)).componentInstance;
    search.dataSelected.emit({ data: { cbdbId: 'downloaded-id' }, fields: ['cbdbId'] });
    expect(component.authorForm.controls.cbdbId.value).toBe('downloaded-id');

    const picture = fixture.debugElement.query(By.directive(LibraryPictureComponent)).componentInstance;
    picture.onPicChanged('/ebook-library/selected.jpg');
    await component.onUpdateAuthor();
    expect(database.updateAuthor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Edited',
        img: '/ebook-library/selected.jpg',
        cbdbId: 'downloaded-id',
      }),
    );

    const book: AUTHORSBOOKS = {
      id: '99',
      title: 'Imported',
      creatorIds: [42],
      progress: null,
      img: null,
      serie: null,
      serieOrder: null,
    };
    fixture.debugElement.query(By.directive(AuthorBooksComponent)).componentInstance.bookAdded.emit(book);
    fixture.detectChanges();
    expect(component.books).toContain(book);
    expect(fixture.nativeElement.textContent).toContain('Imported');
  });

  it('keeps the selected picture when deleting its file fails', async () => {
    await initialize();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    files.removeFile.mockRejectedValue(new Error('File is in use'));
    const fixture = TestBed.createComponent(LibraryPictureComponent);
    fixture.componentRef.setInput('imageControl', page.authorForm.controls.img);
    fixture.componentRef.setInput('owner', {
      type: 'author',
      path: author.path,
      name: author.name,
      surname: author.surname,
    });
    fixture.componentRef.setInput('images', [author.img]);
    fixture.componentRef.setInput('editing', true);
    await (fixture.componentInstance as any).onRemovePic();
    expect(page.authorForm.controls.img.value).toBe(author.img);
  });
});
