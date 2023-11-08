import { Component, ElementRef, EventEmitter, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';
import { IonicSlides } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { FilePath } from '@awesome-cordova-plugins/file-path/ngx';

import { register } from 'swiper/element/bundle';

import { DirectoryService } from 'src/app/services/directory.service';
import { FilePicker } from '@capawesome/capacitor-file-picker';


register();

@Component({
  selector: 'app-picture',
  templateUrl: './picture.component.html',
  styleUrls: ['./picture.component.scss']
})
export class PictureComponent {
  @ViewChild('swiperRef') swiperRef: ElementRef | undefined;

  @Input() imgPreLink: string;
  @Input() images: string[];
  @Input() dirPath: string;
  @Output() changeEvent: EventEmitter<string> = new EventEmitter();
  protected imgIndex: number;
  protected swiperModules = [IonicSlides];


  constructor(
    private renderer: Renderer2,
    private filePath: FilePath,
    private dir: DirectoryService,
  ) { }

  protected onGetImgSrc(img: string): string {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  protected async onResizeSwiper(): Promise<void> {
    if (!this.swiperRef?.nativeElement) await this.wait(200);
    if (!this.swiperRef?.nativeElement) return;
    this.imgIndex = this.swiperRef?.nativeElement.swiper.activeIndex;
    console.log(this.imgIndex)
    const imgEl = this.swiperRef.nativeElement.querySelectorAll('img')[this.imgIndex];
    let height = imgEl.naturalHeight;
    const width = imgEl.naturalWidth;
    if (window.innerWidth < width) {
      height = height * window.innerWidth / width;
    }
    this.renderer.setStyle(this.swiperRef.nativeElement, 'height', `${Math.max(height, 100)}px`);
    this.changeEvent.emit(this.images[this.imgIndex] || null);
  }

  private async wait(n: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), n);
    });
  }

  protected fileChoose(title: string) {
    FilePicker.pickFiles({
      types: ['image/*']
    }).then(async resp => {
      const name = resp.files[0].name;
      const extension = name.slice(name.lastIndexOf('.') + 1);

      Filesystem.copy({
        from: await this.filePath.resolveNativePath(resp.files[0].path),
        to: await this.getUniqueFileName({ dir: this.dirPath, name: title, extension }),
        toDirectory: this.dir.dir
      }).then(a => {
        this.images.push(decodeURI(a.uri.replace(/.*ebook-library/, '/ebook-library')).replace(/%2C /g, ', '));
        this.swiperRef.nativeElement.swiper.slideTo(this.images.length - 1);
        this.imgIndex = this.images.length - 1;
        setTimeout(() => this.onResizeSwiper(), 100);
      });
    }).catch(e => alert('uri' + JSON.stringify(e)));
  }

  private async getUniqueFileName(dt: { dir: string, name: string, extension: string }): Promise<string> {
    for (let i = 0; i < 100; i++) {
      try {
        await Filesystem.stat({
          path: dt.dir + dt.name + '.' + dt.extension,
          directory: this.dir.dir
        });
        return this.getUniqueFileName({ ...dt, name: dt.name + i, extension: dt.extension });
      } catch (e) {
        if (e.message !== 'File does not exist') throw e;
        return dt.dir + dt.name + '.' + dt.extension;
      }
    }
  }

  public deleteCurrentImg(img?: string): void {
    if (img) this.images.splice(this.imgIndex, 1, img);
    else this.images.splice(this.imgIndex, 1);
    setTimeout(() => this.onResizeSwiper(), 100);
  }

  public getCurrentImg(): string {
    return this.images[this.imgIndex];
  }

  public addPicture(title: string) {
    this.fileChoose(title);
  }

}
