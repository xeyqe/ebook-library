import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Directory } from '@capacitor/filesystem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { LibraryPictureComponent, PICTURE_FILESYSTEM, PictureOwner } from './library-picture.component';

const owners: { label: string; owner: PictureOwner; directory: string; filename: string; savedPath: string }[] = [
  {
    label: 'author',
    owner: { type: 'author', path: '/ebook-library/Jane/', name: 'Jane', surname: 'Doe' },
    directory: '/ebook-library/Jane/',
    filename: 'Jane_Doe.jpg',
    savedPath: '/ebook-library/Jane/Jane_Doe.jpg',
  },
  {
    label: 'book',
    owner: {
      type: 'book',
      id: 7,
      path: '/ebook-library/Jane/Book.epub',
      title: 'Original title',
      editedTitle: 'Edited title',
    },
    directory: '/ebook-library/Jane/',
    filename: 'Original title.jpg',
    savedPath: '/ebook-library/Jane/Book.jpg',
  },
];

describe('LibraryPictureComponent', () => {
  let files: any;
  let copy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    copy = vi.fn().mockResolvedValue({ uri: 'file://saved.jpg' });
    files = {
      downloadPicture: vi.fn().mockResolvedValue('/ebook-library/downloaded.jpg'),
      getUniquePath: vi.fn().mockImplementation(async (path) => path),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FileReaderService, useValue: files },
        { provide: PICTURE_FILESYSTEM, useValue: { copy } },
        { provide: DatabaseService, useValue: {} },
        {
          provide: DirectoryService,
          useValue: { dir: Directory.Data, imgPreLink: vi.fn().mockReturnValue('file://') },
        },
        { provide: MatDialog, useValue: {} },
        BusyService,
      ],
    });
    TestBed.overrideComponent(LibraryPictureComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function create(owner: PictureOwner, image: string) {
    const fixture = TestBed.createComponent(LibraryPictureComponent);
    const control = new FormControl(image);
    fixture.componentRef.setInput('owner', owner);
    fixture.componentRef.setInput('imageControl', control);
    fixture.componentRef.setInput('images', [image]);
    fixture.componentRef.setInput('editing', true);
    return { component: fixture.componentInstance as any, control };
  }

  it.each(owners)(
    'downloads a $label image using its existing filename and folder',
    async ({ owner, directory, filename }) => {
      const { component, control } = create(owner, 'https://example.test/cover.jpg?size=200');
      await component.downloadPicture();
      expect(files.downloadPicture).toHaveBeenCalledWith('https://example.test/cover.jpg', directory, filename);
      expect(control.value).toBe('/ebook-library/downloaded.jpg');
      expect(TestBed.inject(BusyService).working()).toBe(false);
    },
  );

  it.each(owners)('copies an extracted cover to the $label image path before saving', async ({ owner, savedPath }) => {
    const { component } = create(owner, '/ebook-library/epub/cover.jpg');
    await expect(component.prepareImageForSave()).resolves.toBe(savedPath);
    expect(copy).toHaveBeenCalledWith({
      from: '/ebook-library/epub/cover.jpg',
      to: savedPath,
      directory: Directory.Data,
      toDirectory: Directory.Data,
    });
  });

  it('releases the busy state and retains the selected image after download failure', async () => {
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    files.downloadPicture.mockRejectedValue(new Error('Download failed'));
    const { component, control } = create(owners[0].owner, 'https://example.test/cover.jpg');
    await component.downloadPicture();
    expect(control.value).toBe('https://example.test/cover.jpg');
    expect(TestBed.inject(BusyService).working()).toBe(false);
  });
});
