import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, Renderer2, SimpleChanges, ViewChild } from '@angular/core';
import { Filesystem } from '@capacitor/filesystem';
import { IonicSlides } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { register } from 'swiper/element/bundle';

import { DirectoryService } from 'src/app/services/directory.service';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { AllFilesAccess } from 'capacitor-all-files-access-permission';

register();

@Component({
  selector: 'app-picture',
  templateUrl: './picture.component.html',
  styleUrls: ['./picture.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PictureComponent implements OnInit, OnChanges {
  @ViewChild('swiperRef') swiperRef: ElementRef | undefined;

  @Input() imgPreLink: string;
  @Input() images: string[];
  @Input() dirPath: string;
  @Output() changeEvent: EventEmitter<string> = new EventEmitter();
  protected imgIndex: number;
  protected swiperModules = [IonicSlides];


  constructor(
    private dir: DirectoryService,
    private renderer: Renderer2,
  ) { }

  ngOnInit(): void {
    this.imgIndex = this.swiperRef?.nativeElement.swiper.activeIndex ?? 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes)
    this.wait(200).then(() => this.onResizeSwiper());
  }

  protected onGetImgSrc(img: string): string {
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imgPreLink + img) : img;
  }

  protected onResizeSwiper = async (ev?): Promise<void> => {
    console.log(ev)
    if (!this.swiperRef?.nativeElement) await this.wait(200);
    if (!this.swiperRef?.nativeElement) return;
    this.imgIndex = this.swiperRef?.nativeElement.swiper.activeIndex;
    const imgEl = this.swiperRef.nativeElement.querySelectorAll('img')[this.imgIndex];
    let height = imgEl.naturalHeight;
    const width = imgEl.naturalWidth;
    if (window.innerWidth < width) {
      height = height * window.innerWidth / width;
    }
    this.renderer.setStyle(this.swiperRef.nativeElement, 'height', `${Math.max(height, 100)}px`);
    if (ev) this.changeEvent.emit(this.images[this.imgIndex] || null);
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
      const file = resp.files[0];
      const name = file.name;
      const extension = name.slice(name.lastIndexOf('.') + 1);
      const path = await this.getUniqueFileName({ dir: this.dirPath, name: title, extension });
      const destUri = (await Filesystem.getUri({
        directory: this.dir.dir,
        path
      })).uri;
      AllFilesAccess.copyFile({ sourceUri: file.path, destinationUri: destUri }).then(() => {
        this.images.push(decodeURI(destUri.replace(/.*ebook-library/, '/ebook-library')).replace(/%2C /g, ', '));
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
