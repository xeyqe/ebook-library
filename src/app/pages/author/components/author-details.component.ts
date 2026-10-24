import { controlValueSignal } from 'src/app/utils/control-value-signal';
import {
  signal,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnChanges,
  Renderer2,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { NgsContenteditableModule } from '@ng-stack/contenteditable';
import { ContenteditableComponent } from 'src/app/components/contenteditable/contenteditable.component';
import { AuthorField, AuthorForm, AuthorSuggestions, AuthorValues } from '../author-form';

@Component({
  selector: 'app-author-details',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './author-details.component.html',
  styleUrl: './author-details.component.scss',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    NgsContenteditableModule,
    ContenteditableComponent,
  ],
})
export class AuthorDetailsComponent implements OnDestroy, OnChanges {
  readonly form = input.required<AuthorForm>();
  protected readonly formValues = controlValueSignal(this.form);
  readonly suggestions = input.required<AuthorSuggestions>();
  readonly editing = input.required<boolean>();
  protected readonly editableFields = ['name', 'surname', 'pseudonym', 'nationality', 'birth', 'death'] as const;
  protected readonly textColor = computed(() => (this.editing() ? 'white' : 'gray'));
  protected readonly focusedField = signal<AuthorField>(null);
  protected readonly biographyReduced = signal(true);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
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
  private defer(callback: () => void, delay = 0): void {
    if (this.destroyRef.destroyed) return;
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.destroyRef.destroyed) callback();
    }, delay);
    this.timers.add(timer);
  }

  protected onFocus(fcNm: AuthorField) {
    this.defer(() => this.focusedField.set(fcNm), 1);
  }

  protected onBlur() {
    this.defer(() => this.focusedField.set(null));
  }

  protected onInput<Key extends AuthorField>(field: Key, value: AuthorValues[Key]): void {
    this.form().controls[field].setValue(value);
  }

  protected onReduceHeight() {
    if (this.form().controls.biography.disabled) this.biographyReduced.set(!this.biographyReduced());
  }

  ngOnDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
  }
}
