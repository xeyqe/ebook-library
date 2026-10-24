import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { AllFilesAccess } from 'capacitor-all-files-access-permission';
import { AUTHOR, AUTHORSBOOKS } from 'src/app/services/interfaces';
import { DatabaseService } from 'src/app/services/database.service';
import { DirectoryService } from 'src/app/services/directory.service';
import { FileReaderService } from 'src/app/services/file-reader.service';
import { PercentPipe } from 'src/app/pipes/percent2.pipe';

export interface AuthorSeries {
  name: string;
  open: boolean;
  books: AUTHORSBOOKS[];
}

@Component({
  selector: 'app-author-books',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './author-books.component.html',
  styleUrl: './author-books.component.scss',
  imports: [RouterLink, IonicModule, MatProgressBarModule, MatFormFieldModule, PercentPipe],
})
export class AuthorBooksComponent {
  readonly author = input.required<AUTHOR>();
  readonly books = input.required<AUTHORSBOOKS[]>();
  readonly series = model.required<AuthorSeries[]>();
  readonly imagePrefix = input.required<string>();
  readonly bookAdded = output<AUTHORSBOOKS>();
  private readonly db = inject(DatabaseService);
  private readonly directoryServ = inject(DirectoryService);
  private readonly fs = inject(FileReaderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly imgSuffix = Math.floor(Math.random() * 1000000);
  protected toggleSeries(name: string): void {
    this.series.update((series) => series.map((item) => (item.name === name ? { ...item, open: !item.open } : item)));
  }
  async addBooks(): Promise<void> {
    if (!this.author()) return;
    try {
      const { files } = await FilePicker.pickFiles({
        types: ['application/epub+zip', 'text/plain', 'application/pdf'],
      });
      if (this.destroyRef.destroyed) return;
      for (const file of files) {
        const title = file.name.substring(0, file.name.lastIndexOf('.'));
        const path = await this.fs.getUniquePath(`${this.author().path.replace(/\/+$/, '')}/${file.name}`);

        const destUri = (
          await Filesystem.getUri({
            directory: this.directoryServ.dir,
            path,
          })
        ).uri;

        await AllFilesAccess.copyFile({ sourceUri: file.path, destinationUri: destUri });

        const bookId = await this.db.addBook({
          id: null,
          title: title,
          creatorIds: [this.author().id],
          originalTitle: null,
          annotation: null,
          publisher: null,
          published: null,
          genre: null,
          length: null,
          language: 'cs-CZ',
          translator: null,
          ISBN: null,
          path,
          progress: null,
          rating: null,
          img: null,
          serie: null,
          serieOrder: null,
          dtbkId: null,
          lgId: null,
          cbdbId: null,
          added: new Date(),
          lastRead: null,
          finished: null,
        });
        if (!this.destroyRef.destroyed)
          this.bookAdded.emit({
            id: bookId + '',
            title: title,
            creatorIds: [this.author().id],
            progress: null,
            img: null,
            serie: null,
            serieOrder: null,
          });
      }
    } catch (error) {
      console.error('Unable to import author books', error);
    }
  }

  protected onGetImgSrc(img: string) {
    if (!img) img = '/ebook-library/unknown.jpg';
    return img?.startsWith('/') ? Capacitor.convertFileSrc(this.imagePrefix() + img) + `?ver=${this.imgSuffix}` : img;
  }
}
