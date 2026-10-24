import { controlValueSignal } from 'src/app/utils/control-value-signal';
import {
  signal,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnChanges,
  OnDestroy,
  Renderer2,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { NgsContenteditableModule } from '@ng-stack/contenteditable';
import { ContenteditableComponent } from 'src/app/components/contenteditable/contenteditable.component';
import { BookField, BookForm, BookSuggestions, BookValues } from '../book-form';
@Component({
  selector: 'app-book-details',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './book-details.component.html',
  styleUrl: './book-details.component.scss',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    NgsContenteditableModule,
    ContenteditableComponent,
  ],
})
export class BookDetailsComponent implements OnChanges, OnDestroy {
  readonly form = input.required<BookForm>();
  protected readonly formValues = controlValueSignal(this.form);
  readonly suggestions = input.required<BookSuggestions>();
  readonly editing = input.required<boolean>();
  protected readonly textColor = computed(() => (this.editing() ? 'white' : 'gray'));
  protected readonly fields = [
    { key: 'serie', label: 'Serie' },
    { key: 'serieOrder', label: 'Serie order' },
    { key: 'title', label: 'Title' },
    { key: 'originalTitle', label: 'Original title' },
    { key: 'genre', label: 'Genre' },
    { key: 'ISBN', label: 'ISBN' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'published', label: 'Published' },
  ] as const;
  protected readonly dates = [
    { key: 'added', label: 'Added' },
    { key: 'lastRead', label: 'Last Read' },
    { key: 'finished', label: 'Finished' },
  ] as const;
  protected readonly focusedOn = signal<BookField>(null);
  protected readonly annotationReduced = signal(true);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  ngOnChanges(): void {
    afterNextRender(
      () => {
        for (const field of this.host.nativeElement.querySelectorAll<HTMLElement>('mat-form-field')) {
          const width = field.querySelector('mat-label')?.getBoundingClientRect().width;
          if (width) this.renderer.setStyle(field, 'minWidth', `${Math.ceil(width + 16)}px`);
        }
      },
      { injector: this.injector },
    );
  }
  protected onInput<Key extends BookField>(field: Key, value: BookValues[Key]): void {
    this.form().controls[field].setValue(value);
  }
  private defer(callback: () => void, delay = 0): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.destroyRef.destroyed) callback();
    }, delay);
    this.timers.add(timer);
  }
  protected onFocus(field: BookField): void {
    this.defer(() => this.focusedOn.set(field), 1);
  }
  protected onBlur(): void {
    this.defer(() => this.focusedOn.set(null));
  }
  protected onReduceHeight(): void {
    if (this.form().controls.annotation.disabled) this.annotationReduced.set(!this.annotationReduced());
  }
  ngOnDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
  }
}
