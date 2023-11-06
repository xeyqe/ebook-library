import { Component, ElementRef, EventEmitter, Input, Output, Renderer2, ViewChild } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IonicSlides } from '@ionic/angular';

import { FilePath } from '@awesome-cordova-plugins/file-path/ngx';
import { FileChooser } from '@awesome-cordova-plugins/file-chooser/ngx';

import { register } from 'swiper/element/bundle';
import { Filesystem } from '@capacitor/filesystem';
import { DirectoryService } from 'src/app/services/directory.service';


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
    private fileChooser: FileChooser,
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

  protected fileChoose() {
    this.fileChooser.open({ mime: 'image/*' } as any).then(uri => {
      this.filePath.resolveNativePath(uri).then(async file => {
        const extension = file.slice(file.lastIndexOf('.') + 1);
        const name = file.slice(file.lastIndexOf('/') + 1, - extension.length - 1);
        Filesystem.copy({
          from: file,
          to: await this.getUniqueFileName({ dir: this.dirPath, name, extension }),
          toDirectory: this.dir.dir
        }).then(a => {
          console.log(a.uri)
          this.images.push(decodeURI(a.uri.replace(/.*ebook-library/, '/ebook-library')).replace(/%2C /g, ', '));
          console.log(this.images)
          this.swiperRef.nativeElement.swiper.slideTo(this.images.length - 1);
          this.imgIndex = this.images.length - 1;
          console.log(this.imgIndex)
          setTimeout(() => this.onResizeSwiper(), 100);
        });
      }).catch(err => console.log(err));
    }).catch(e => alert('uri' + JSON.stringify(e)));
  }

  private async getUniqueFileName(dt: { dir: string, name: string, extension: string }): Promise<string> {
    for (let i = 0; i < 100; i++) {
      try {
        await Filesystem.stat({
          path: dt.dir + dt.name + '.' + dt.extension,
          directory: this.dir.dir
        });
        return this.getUniqueFileName({ ...dt, name: dt.name + i });
      } catch (e) {
        if (e.message !== 'File does not exist') throw e;
        return dt.dir + dt.name + '.' + dt.extension;
      }
    }
  }

  public deleteCurrentImg(): void {
    this.images.splice(this.imgIndex, 1);
    setTimeout(() => this.onResizeSwiper(), 100);
  }

  public getCurrentImg(): string {
    return this.images[this.imgIndex];
  }

  public addPicture() {
    this.fileChoose();
  }

}
