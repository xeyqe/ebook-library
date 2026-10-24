import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  OnChanges,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';
import { IonicSlides } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { register } from 'swiper/element/bundle';

import { DirectoryService } from 'src/app/services/directory.service';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { AllFilesAccess } from 'capacitor-all-files-access-permission';

register();

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-picture',
  templateUrl: './picture.component.html',
  styleUrls: ['./picture.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PictureComponent implements OnChanges {
  private readonly swiperRef = viewChild<ElementRef>('swiperRef');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly imgPreLink = input('');
  readonly images = model<string[]>([]);
  readonly dirPath = input('');
  readonly changeEvent = output<string>();
  protected readonly imgIndex = signal(0);
  protected readonly swiperModules = [IonicSlides];

  private readonly dir = inject(DirectoryService);
  private readonly renderer = inject(Renderer2);

  ngOnChanges(): void {
    afterNextRender(
      () => {
        void this.onResizeSwiper();
      },
      { injector: this.injector },
    );
  }

  protected onGetImgSrc(img: string): string {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink() + img) : img;
  }

  protected onResizeSwiper = async (ev?): Promise<void> => {
    if (!this.swiperRef()?.nativeElement) await this.wait(200);
    if (!this.swiperRef()?.nativeElement) return;
    if (this.destroyRef.destroyed) return;
    this.imgIndex.set(this.swiperRef()?.nativeElement.swiper?.activeIndex ?? 0);
    const imgEl = this.swiperRef().nativeElement.querySelectorAll('img')[this.imgIndex()];
    if (!imgEl) return;
    let height = imgEl.naturalHeight;
    const width = imgEl.naturalWidth;
    if (window.innerWidth < width) {
      height = (height * window.innerWidth) / width;
    }
    this.renderer.setStyle(this.swiperRef().nativeElement, 'height', `${Math.max(height, 100)}px`);
    if (ev) this.changeEvent.emit(this.images()[this.imgIndex()] || null);
  };

  private async wait(n: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), n);
    });
  }

  protected fileChoose(title: string) {
    FilePicker.pickFiles({
      types: ['image/*'],
    })
      .then(async (resp) => {
        const file = resp.files[0];
        const name = file.name;
        const extension = name.slice(name.lastIndexOf('.') + 1);
        const path = await this.getUniqueFileName({ dir: this.dirPath(), name: title, extension });
        const destUri = (
          await Filesystem.getUri({
            directory: this.dir.dir,
            path,
          })
        ).uri;
        AllFilesAccess.copyFile({ sourceUri: file.path, destinationUri: destUri }).then(() => {
          if (this.destroyRef.destroyed) return;
          const image = decodeURI(destUri.replace(/.*ebook-library/, '/ebook-library')).replace(/%2C /g, ', ');
          this.images.update((images) => [...images, image]);
          this.imgIndex.set(this.images().length - 1);
          this.changeEvent.emit(image);
          afterNextRender(
            () => {
              this.swiperRef()?.nativeElement.swiper?.slideTo(this.imgIndex());
              void this.onResizeSwiper();
            },
            { injector: this.injector },
          );
        });
      })
      .catch((e) => alert('uri' + JSON.stringify(e)));
  }

  private async getUniqueFileName(dt: { dir: string; name: string; extension: string }): Promise<string> {
    for (let i = 0; i < 100; i++) {
      try {
        await Filesystem.stat({
          path: dt.dir + dt.name + '.' + dt.extension,
          directory: this.dir.dir,
        });
        return this.getUniqueFileName({ ...dt, name: dt.name + i, extension: dt.extension });
      } catch (e) {
        if (e.message !== 'File does not exist') throw e;
        return dt.dir + dt.name + '.' + dt.extension;
      }
    }
  }

  public deleteCurrentImg(img?: string): void {
    this.images.update((images) =>
      img
        ? images.map((image, index) => (index === this.imgIndex() ? img : image))
        : images.filter((_, index) => index !== this.imgIndex()),
    );
    this.imgIndex.set(Math.min(this.imgIndex(), Math.max(0, this.images().length - 1)));
    afterNextRender(
      () => {
        void this.onResizeSwiper();
      },
      { injector: this.injector },
    );
  }

  public getCurrentImg(): string {
    return this.images()[this.imgIndex()];
  }

  public addPicture(title: string) {
    this.fileChoose(title);
  }
}
