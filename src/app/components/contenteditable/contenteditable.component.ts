import { DOCUMENT } from '@angular/common';
import { Subject } from 'rxjs';
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DoCheck,
  OnDestroy,
  ElementRef,
  inject,
  input,
  Input,
  output,
  SecurityContext,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroupDirective, NgControl, NgForm } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormField, MatFormFieldControl } from '@angular/material/form-field';

@Component({
  selector: 'app-contenteditable',
  templateUrl: './contenteditable.component.html',
  styleUrl: './contenteditable.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [{ provide: MatFormFieldControl, useExisting: ContenteditableComponent }],
  host: {
    '[id]': 'id',
    '[class.floating]': 'shouldLabelFloat()',
    '[class.disabled]': 'disabled()',
  },
})
export class ContenteditableComponent
  implements ControlValueAccessor, MatFormFieldControl<string>, AfterViewInit, DoCheck, OnDestroy
{
  private static nextId = 0;
  readonly id = `content-editable-${ContenteditableComponent.nextId++}`;
  readonly controlType = 'contenteditable';
  readonly disableAutomaticLabeling = true;
  readonly placeholder = input('');
  readonly required = input(false, { transform: booleanAttribute });
  // eslint-disable-next-line @angular-eslint/no-input-rename -- Keep the disabled API while combining input and form state.
  readonly disabledInput = input(false, { alias: 'disabled', transform: booleanAttribute });
  readonly ariaLabel = input('', { alias: 'aria-label' });
  // eslint-disable-next-line @angular-eslint/no-input-rename -- Material requires this property name for the standard ARIA input.
  readonly userAriaDescribedBy = input('', { alias: 'aria-describedby' });
  readonly errorStateMatcher = input<ErrorStateMatcher>();
  readonly _onFocus = output<void>();
  readonly _onBlur = output<void>();
  // Material 22 still uses this stream to synchronize focus styling and error description IDs.
  readonly stateChanges = new Subject<void>();
  readonly focused = signal(false);
  readonly errorState = signal(false);
  readonly disabled = computed(() => this.disabledInput() || this.formDisabled());
  readonly empty = computed(() => !this.textContent());
  readonly shouldLabelFloat = computed(() => this.focused() || !this.empty());
  protected readonly describedBy = computed(() =>
    [...new Set([...this.userAriaDescribedBy().split(/\s+/).filter(Boolean), ...this.describedIds()])].join(' '),
  );
  readonly ngControl = inject(NgControl, { optional: true, self: true });
  protected readonly formField = inject(MatFormField, { optional: true });
  private readonly parentForm = inject(NgForm, { optional: true });
  private readonly parentFormGroup = inject(FormGroupDirective, { optional: true });
  private readonly defaultErrorStateMatcher = inject(ErrorStateMatcher);
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly editor = viewChild<ElementRef<HTMLElement>>('editor');
  private readonly currentValue = signal<string | null>(null);
  private readonly textContent = signal('');
  private readonly formDisabled = signal(false);
  private readonly describedIds = signal<string[]>([]);
  private composing = false;
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  @Input()
  get value(): string | null {
    return this.currentValue();
  }
  set value(value: string | number | null) {
    this.writeValue(value);
  }

  ngAfterViewInit(): void {
    this.renderValue();
  }

  ngDoCheck(): void {
    const matcher = this.errorStateMatcher() ?? this.defaultErrorStateMatcher;
    const error = matcher.isErrorState(this.ngControl?.control as FormControl, this.parentFormGroup || this.parentForm);
    if (this.errorState() !== error) {
      this.errorState.set(error);
      this.stateChanges.next();
    }
  }

  writeValue(value: string | number | null): void {
    const html = this.sanitizer.sanitize(SecurityContext.HTML, value == null ? '' : String(value)) || '';
    const content = this.document.createElement('div');
    content.innerHTML = html;
    this.currentValue.set(content.innerHTML || null);
    this.textContent.set(content.textContent || '');
    this.renderValue();
  }

  registerOnChange(callback: (value: string | null) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    this.stateChanges.next();
  }

  setDescribedByIds(ids: string[]): void {
    this.describedIds.set(ids);
  }

  private renderValue(): void {
    const editor = this.editor()?.nativeElement;
    const html = this.currentValue() || '';
    if (editor && editor.innerHTML !== html) editor.innerHTML = html;
  }

  protected onInput(event: InputEvent): void {
    if (!this.composing && !event.isComposing) this.commitValue();
  }

  protected onCompositionStart(): void {
    this.composing = true;
  }

  protected onCompositionEnd(): void {
    this.composing = false;
    this.commitValue();
  }

  private commitValue(): void {
    const editor = this.editor()?.nativeElement;
    if (!editor) return;
    if (this.disabled()) {
      this.renderValue();
      return;
    }
    const previous = this.value;
    this.writeValue(editor.textContent ? editor.innerHTML : null);
    if (this.value !== previous) this.onChange(this.value);
  }

  protected onFocusIn(): void {
    if (this.disabled() || this.focused()) return;
    this.focused.set(true);
    this.stateChanges.next();
    this._onFocus.emit();
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.focused() || this.host.nativeElement.contains(event.relatedTarget as Node)) return;
    this.focused.set(false);
    this.stateChanges.next();
    this.onTouched();
    this._onBlur.emit();
  }

  focus(): void {
    const editor = this.editor()?.nativeElement;
    if (!editor || this.disabled() || this.document.activeElement === editor) return;
    editor.focus();
    const range = this.document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = this.document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  onContainerClick(event: MouseEvent): void {
    if (!this.editor()?.nativeElement.contains(event.target as Node)) this.focus();
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (this.disabled()) return;
    const text = event.clipboardData?.getData('text/plain');
    const editor = this.editor()?.nativeElement;
    if (!text || !editor) return;
    editor.focus();
    const selection = this.document.getSelection();
    const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const range =
      selectedRange && editor.contains(selectedRange.commonAncestorContainer)
        ? selectedRange
        : this.document.createRange();
    if (range !== selectedRange) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const node = this.document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.commitValue();
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
  }
}
