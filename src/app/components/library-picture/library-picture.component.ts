import { controlValueSignal } from 'src/app/utils/control-value-signal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  linkedSignal,
  DestroyRef,
  inject,
  InjectionToken,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { PictureComponent } from 'src/app/pages/picture/picture.component';
import { BusyService } from 'src/app/services/busy.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';

export type PictureOwner =
  | { type: 'author'; path: string; name: string; surname: string }
  | { type: 'book'; id: number; path: string; title: string; editedTitle: string };

export const PICTURE_FILESYSTEM = new InjectionToken<Pick<typeof Filesystem, 'copy'>>('Picture filesystem', {
  providedIn: 'root',
  factory: () => ({ copy: (options) => Filesystem.copy(options) }),
});

@Component({
  selector: 'app-library-picture',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './library-picture.component.html',
  styleUrl: './library-picture.component.scss',
  imports: [MatButtonModule, MatIconModule, PictureComponent],
})
export class LibraryPictureComponent {
  readonly imageControl = input.required<FormControl<string>>();
  protected readonly imageValue = controlValueSignal(this.imageControl);
  readonly owner = input.required<PictureOwner>();
  readonly images = input.required<string[]>();
  protected readonly displayImages = linkedSignal(() => this.images());
  readonly editing = input.required<boolean>();
  readonly operationFinished = output<void>();

  protected readonly directory = computed(() => {
    const owner = this.owner();
    return owner.type === 'author' ? owner.path : owner.path.slice(0, owner.path.lastIndexOf('/') + 1);
  });
  private readonly filename = computed(() => {
    const owner = this.owner();
    return owner.type === 'author' ? [owner.name || '', owner.surname || ''].join('_') : owner.title;
  });
  protected readonly dir = inject(DirectoryService);
  private readonly picture = viewChild(PictureComponent);
  private readonly filesystem = inject(PICTURE_FILESYSTEM);
  private readonly fs = inject(FileReaderService);
  private readonly db = inject(DatabaseService);
  private readonly dialog = inject(MatDialog);
  private readonly working = inject(BusyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly imageVersion = Math.floor(Math.random() * 1000000);

  async prepareImageForSave(): Promise<string> {
    const img = this.picture()?.getCurrentImg() ?? this.imageControl().value;
    const cached = img?.startsWith('file://');
    if (!cached && !img?.startsWith('/ebook-library/epub/')) return img;
    const owner = this.owner();
    const stem =
      owner.type === 'author' ? this.directory() + this.filename() : owner.path.slice(0, owner.path.lastIndexOf('.'));
    const path = await this.fs.getUniquePath(stem + img.slice(img.lastIndexOf('.')));
    await this.filesystem.copy({
      ...(cached ? {} : { directory: this.dir.dir }),
      toDirectory: this.dir.dir,
      from: img,
      to: path,
    });
    return path;
  }

  protected canRemovePicture(): boolean {
    const img = this.imageControl().value;
    return !!img && (img.startsWith('/') || this.owner().type === 'book');
  }

  protected async onRemovePic(): Promise<void> {
    const img = this.picture()?.getCurrentImg() ?? this.imageControl().value;
    if (!img) return;
    try {
      if (img.startsWith('/')) {
        const owner = this.owner();
        if (owner.type === 'book' && (await this.db.isPictureUsedElsewhere(img, owner.id))) return;
        await this.fs.removeFile(img);
      }
      if (this.destroyRef.destroyed) return;
      this.imageControl().setValue(null);
      this.picture()?.deleteCurrentImg();
    } catch (error) {
      console.error('Unable to remove picture', error);
      if (!this.destroyRef.destroyed)
        this.dialog.open(DialogComponent, {
          data: { header: 'Warning', message: 'Deleting of pic file failed!', selects: ['Ok'] },
        });
    }
  }

  protected async downloadPicture(): Promise<void> {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    let uri = this.imageControl().value;
    if (!uri) return;
    if (uri.lastIndexOf('.') < uri.lastIndexOf('?')) uri = uri.slice(0, uri.lastIndexOf('?'));
    const filename = this.filename() + uri.slice(uri.lastIndexOf('.'));
    this.working.busy();
    try {
      const source = await this.fs.downloadPicture(uri, this.directory(), filename);
      if (this.destroyRef.destroyed) return;
      const img = source?.replace(/^.*ebook-library/, '/ebook-library');
      this.imageControl().setValue(img);
      this.picture()?.deleteCurrentImg(img);
    } catch (error) {
      console.error('Unable to download picture', error);
      if (!this.destroyRef.destroyed) alert(error instanceof Error ? error.message : String(error));
    } finally {
      this.working.done();
      if (!this.destroyRef.destroyed) this.operationFinished.emit();
    }
  }

  protected onGetImgSrc(img: string): string {
    if (img?.startsWith('file://')) return `${Capacitor.convertFileSrc(img)}?ver=${this.imageVersion}`;
    return img?.startsWith('/')
      ? `${Capacitor.convertFileSrc(this.dir.imgPreLink() + img)}?ver=${this.imageVersion}`
      : img;
  }

  protected onPicChanged(img: string): void {
    this.imageControl().setValue(img);
  }

  protected onAddPicture(): void {
    const owner = this.owner();
    const title = owner.type === 'author' ? [owner.name || '', owner.surname || ''].join(' ') : owner.editedTitle;
    this.picture()?.addPicture(title);
  }
}
