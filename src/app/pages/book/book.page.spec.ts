import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { EpubService } from 'src/app/services/epub.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { BOOK } from 'src/app/services/interfaces';
import { WebScraperService } from 'src/app/services/web-scraper.service';
import { NonusedPicsService } from '../author/nonused-pics.service';
import { BookBrowserService } from './book-browser.service';
import { BookComponent } from './book.page';
import { BookDetailsComponent } from './components/book-details.component';
import { BookOnlineSearchComponent } from './components/book-online-search.component';
import { LibraryPictureComponent } from 'src/app/components/library-picture/library-picture.component';

describe('BookComponent', () => {
  let page: any;
  let ready: BehaviorSubject<boolean>;
  let book: BOOK;
  let database: any;
  let files: any;
  let scraper: any;
  let epub: any;
  let browser: any;

  async function initialize() {
    ready.next(true);
    await page.ionViewDidEnter();
  }

  beforeEach(() => {
    ready = new BehaviorSubject(false);
    book = {
      id: 7,
      title: 'Original',
      creatorIds: [42],
      originalTitle: null,
      annotation: 'Annotation',
      publisher: 'Publisher',
      published: 2000,
      genre: 'Fiction',
      length: 300,
      language: 'cs-CZ',
      translator: null,
      ISBN: '123',
      path: '/ebook-library/Author/Book.epub',
      progress: '5/10',
      rating: 0,
      img: '/ebook-library/cover.jpg',
      serie: null,
      serieOrder: null,
      dtbkId: 'old-id',
      lgId: 'legie-id',
      cbdbId: null,
      added: new Date('2026-01-01'),
      lastRead: null,
      finished: null,
    };
    database = {
      getDatabaseState: () => ready.asObservable(),
      getBook: vi.fn().mockResolvedValue(book),
      updateBook: vi.fn().mockResolvedValue(undefined),
      isPictureUsedElsewhere: vi.fn().mockResolvedValue(false),
      isBookFileUsedInDifferentBook: vi.fn().mockResolvedValue(true),
      deleteBook: vi.fn().mockResolvedValue(undefined),
    };
    files = { removeFile: vi.fn().mockResolvedValue(undefined) };
    scraper = { showAble: true, getCBDBBookDetails: vi.fn() };
    epub = { getMetadataFromEpub: vi.fn() };
    browser = { read: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: DatabaseService, useValue: database },
        { provide: FileReaderService, useValue: files },
        { provide: DirectoryService, useValue: { imgPreLink: 'file://' } },
        { provide: EpubService, useValue: epub },
        { provide: WebScraperService, useValue: scraper },
        { provide: MatDialog, useValue: { open: vi.fn().mockReturnValue({ afterClosed: () => of(0) }) } },
        BusyService,
        NonusedPicsService,
      ],
    });
    TestBed.overrideComponent(LibraryPictureComponent, { set: { template: '', imports: [] } });
    TestBed.overrideComponent(BookOnlineSearchComponent, {
      set: { providers: [{ provide: BookBrowserService, useValue: browser }] },
    });
    page = TestBed.runInInjectionContext(() => new BookComponent());
    page.ngOnInit();
  });

  afterEach(() => {
    page.ngOnDestroy();
    ready.complete();
    vi.restoreAllMocks();
  });

  it('waits for database readiness and displays progress without replacing its checkpoint', async () => {
    const entering = page.ionViewDidEnter();
    await Promise.resolve();
    expect(database.getBook).not.toHaveBeenCalled();
    ready.next(true);
    await entering;
    expect(database.getBook).toHaveBeenCalledWith(7);
    expect(page.bookForm.controls.progress.value).toBe('50%');
    expect(page.book.progress).toBe('5/10');
    expect(page.bookForm.controls.rating.value).toBe(0);
  });

  it('restores saved metadata and disables the form when editing is cancelled', async () => {
    await initialize();
    page.editable();
    page.bookForm.patchValue({ title: 'Changed', dtbkId: 'new-id' });
    page.editable();
    expect(page.bookForm.getRawValue()).toMatchObject({ title: 'Original', dtbkId: 'old-id', progress: '50%' });
    expect(page.bookForm.disabled).toBe(true);
    expect(page.bookChanged).toBe(false);
    expect(book.title).toBe('Original');
  });

  it('preserves the reading checkpoint and book identity when saving edited metadata', async () => {
    await initialize();
    page.editable();
    page.bookForm.patchValue({ title: 'Changed', progress: '100%' });
    await page.updateBook();
    expect(database.updateBook).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Changed',
        progress: '5/10',
        id: 7,
        creatorIds: [42],
        path: book.path,
        rating: 0,
      }),
    );
    expect(page.isEditing()).toBe(false);
    expect(page.bookForm.disabled).toBe(true);
  });

  it('keeps edits available and the saved book unchanged after a failed save', async () => {
    await initialize();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    database.updateBook.mockRejectedValue(new Error('Database unavailable'));
    page.editable();
    page.bookForm.controls.title.setValue('Changed');
    await page.updateBook();
    expect(page.isEditing()).toBe(true);
    expect(page.bookForm.enabled).toBe(true);
    expect(page.bookForm.controls.title.value).toBe('Changed');
    expect(book.title).toBe('Original');
  });

  it('imports EPUB metadata and cover suggestions without changing progress', async () => {
    await initialize();
    page.editable();
    epub.getMetadataFromEpub.mockResolvedValue({
      title: 'From EPUB',
      annotation: '<p>Summary</p>',
      imgPaths: ['/ebook-library/epub/cover.jpg'],
    });
    await page.getMetadataFromEpub();
    expect(page.bookForm.getRawValue()).toMatchObject({
      title: 'From EPUB',
      annotation: 'Summary',
      progress: '50%',
      img: '/ebook-library/epub/cover.jpg',
    });
    expect(page.suggestions.img).toEqual(['/ebook-library/epub/cover.jpg']);
    expect(page.bookChanged).toBe(true);
  });

  it('leaves a shared book file in place when its database record is deleted', async () => {
    await initialize();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await page.deleteBook();
    expect(files.removeFile).not.toHaveBeenCalled();
    expect(database.deleteBook).toHaveBeenCalledWith(7);
    expect(navigate).toHaveBeenCalledWith(['/author', 42]);
  });

  it('keeps shared and unsuccessfully deleted cover images selected', async () => {
    await initialize();
    const fixture = TestBed.createComponent(LibraryPictureComponent);
    fixture.componentRef.setInput('owner', {
      type: 'book',
      id: book.id,
      path: book.path,
      title: book.title,
      editedTitle: book.title,
    });
    fixture.componentRef.setInput('imageControl', page.bookForm.controls.img);
    const picture = fixture.componentInstance as any;
    database.isPictureUsedElsewhere.mockResolvedValue(true);
    await picture.onRemovePic();
    expect(files.removeFile).not.toHaveBeenCalled();
    database.isPictureUsedElsewhere.mockResolvedValue(false);
    files.removeFile.mockRejectedValue(new Error('File is in use'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await picture.onRemovePic();
    expect(page.bookForm.controls.img.value).toBe(book.img);
  });

  it('imports the correct Databaze knih identifier from the native browser result', async () => {
    await initialize();
    page.editable();
    const fixture = TestBed.createComponent(BookOnlineSearchComponent);
    fixture.componentRef.setInput('book', book);
    fixture.componentRef.setInput('form', page.bookForm);
    fixture.componentInstance.dataSelected.subscribe((selection) => page.onOnlineData(selection));
    browser.read.mockResolvedValue({ title: 'Downloaded', annotation: 'Summary...celý text', language: 'český' });
    await (fixture.componentInstance as any).downloadBookInfo({
      link: 'https://example.test/book',
      dtbkId: 'selected-id',
    });
    expect(page.bookForm.getRawValue()).toMatchObject({
      title: 'Downloaded',
      annotation: 'Summary',
      language: 'cs-CZ',
      dtbkId: 'selected-id',
      lgId: 'legie-id',
    });
  });

  it('connects the extracted details, pictures and online results to the saved book', async () => {
    ready.next(true);
    const fixture = TestBed.createComponent(BookComponent);
    const component = fixture.componentInstance as any;
    vi.spyOn(component, 'scrollToContent').mockImplementation(() => {});
    fixture.detectChanges();
    await component.ionViewDidEnter();
    fixture.detectChanges();
    component.editable();
    fixture.detectChanges();
    const details = fixture.debugElement.query(By.directive(BookDetailsComponent)).componentInstance;
    details.onInput('title', 'Edited');
    fixture.debugElement
      .query(By.directive(LibraryPictureComponent))
      .componentInstance.onPicChanged('/ebook-library/new.jpg');
    fixture.debugElement
      .query(By.directive(BookOnlineSearchComponent))
      .componentInstance.dataSelected.emit({ data: { cbdbId: 'new-id' }, fields: ['cbdbId'] });
    await component.updateBook();
    expect(database.updateBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Edited', img: '/ebook-library/new.jpg', cbdbId: 'new-id', progress: '5/10' }),
    );
  });
});
