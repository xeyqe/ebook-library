import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { BusyService } from 'src/app/services/busy.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { PictureComponent } from '../../picture/picture.component';
import { AuthorForm } from '../author-form';

@Component({
  selector: 'app-author-picture',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './author-picture.component.html',
  styleUrl: './author-picture.component.scss',
  imports: [MatButtonModule, MatIconModule, PictureComponent],
})
export class AuthorPictureComponent {
  readonly form = input.required<AuthorForm>();
  readonly path = input.required<string>();
  readonly images = input.required<string[]>();
  readonly editing = input.required<boolean>();
  readonly imagePrefix = input.required<string>();
  readonly operationFinished = output<void>();
  private readonly picture = viewChild(PictureComponent);
  private readonly fs = inject(FileReaderService);
  private readonly directoryServ = inject(DirectoryService);
  private readonly workingServ = inject(BusyService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly imgSuffix = Math.floor(Math.random() * 1000000);

  async prepareImageForSave(): Promise<string> {
    let img = this.picture()?.getCurrentImg() ?? this.form().controls.img.value;
    if (img?.startsWith('/ebook-library/epub/')) {
      const { name, surname } = this.form().getRawValue();
      const filename = [name || '', surname || ''].join('_') + img.slice(img.lastIndexOf('.'));
      const path = await this.fs.getUniquePath(this.path() + filename);
      await Filesystem.copy({
        directory: this.directoryServ.dir,
        toDirectory: this.directoryServ.dir,
        from: img,
        to: path,
      });
      img = path;
    }
    return img;
  }
  protected async onDownloadPicture(): Promise<void> {
    if (!navigator.onLine) {
      alert('No internet connection!');
      return;
    }
    let uri = this.form().controls.img.value;
    if (!uri) return;
    if (uri.lastIndexOf('.') < uri.lastIndexOf('?')) uri = uri.slice(0, uri.lastIndexOf('?'));
    const { name, surname } = this.form().getRawValue();
    const filename = `${name}_${surname}${uri.slice(uri.lastIndexOf('.'))}`;
    this.workingServ.busy();
    try {
      const source = await this.fs.downloadPicture(uri, this.path(), filename);
      if (this.destroyRef.destroyed) return;
      const img = source?.replace(/^.*ebook-library/, '/ebook-library');
      this.form().controls.img.setValue(img);
      this.picture()?.deleteCurrentImg(img);
    } catch (error) {
      console.error('Unable to download author picture', error);
      if (!this.destroyRef.destroyed) alert(JSON.stringify(error));
    } finally {
      this.workingServ.done();
      if (!this.destroyRef.destroyed) this.operationFinished.emit();
    }
  }

  protected async onRemovePic(): Promise<void> {
    const img = this.picture()?.getCurrentImg() || this.form().controls.img.value;
    if (!img) return;
    try {
      if (img.startsWith('/')) await this.fs.removeFile(img);
      if (this.destroyRef.destroyed) return;
      this.form().controls.img.setValue(null);
      this.picture()?.deleteCurrentImg();
    } catch (error) {
      console.error('Unable to delete author picture', error);
      if (this.destroyRef.destroyed) return;
      this.dialog.open(DialogComponent, {
        data: {
          header: 'Warning',
          message: 'Deleting of pic file failed!',
          selects: ['Ok'],
        },
      });
    }
  }

  protected onAddPicture() {
    const name = this.form().controls.name.value || '';
    const surname = this.form().controls.surname.value || '';
    this.picture()?.addPicture([name, surname].join(' '));
  }

  protected onDownloadBuVisible(path: string): boolean {
    return !!path && !path.startsWith('/');
  }

  protected onGetImgSrc(img: string) {
    if (!img) img = '/ebook-library/unknown.jpg';
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imagePrefix() + img) + `?ver=${this.imgSuffix}` : img;
  }

  protected onPicChanged(img: string) {
    this.form().controls.img.setValue(img);
  }
}
