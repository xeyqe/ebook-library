import { Component, DoCheck, ElementRef, EventEmitter, HostBinding, Input, OnDestroy, OnInit, Optional, Output, Self, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroupDirective, NgControl, NgForm, ReactiveFormsModule } from '@angular/forms';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldControl, MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { ColorPickerModule } from 'ngx-color-picker';

import { Subject } from 'rxjs';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { MatDialog } from '@angular/material/dialog';


@Component({
    selector: 'app-contenteditable',
    imports: [
        ColorPickerModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        ReactiveFormsModule,
    ],
    providers: [{ provide: MatFormFieldControl, useExisting: ContenteditableComponent }],
    templateUrl: './contenteditable.component.html',
    styleUrl: './contenteditable.component.scss'
})
export class ContenteditableComponent implements ControlValueAccessor, MatFormFieldControl<string>, OnInit, OnDestroy, DoCheck {
  @ViewChild('contenteditableEl', { static: true }) contenteditableEl: ElementRef;

  @Output() _onFocus: EventEmitter<void> = new EventEmitter();
  @Output() _onBlur: EventEmitter<void> = new EventEmitter();
  @Input() value: string;

  protected readonly tools = [
    { id: 'bold', icon: 'format_bold' },
    { id: 'italic', icon: 'format_italic' },
    { id: 'underline', icon: 'format_underlined' },
    { id: 'removeFormat', icon: 'remove' },
    { id: 'unlink', icon: 'link_off' },
    { id: 'createlink', icon: 'link' },
    { id: 'foreColor', icon: 'format_color_text' },
    // { id: 'decreaseFontSize', icon: 'exposure_neg_1' },
    // { id: 'increaseFontSize', icon: 'exposure_plus_1' },
  ];
  protected hyperLinkFc: FormControl<string>;
  protected colorFc: FormControl<string>;

  protected color: string;
  private interval: ReturnType<typeof setTimeout>;

  private onTouched: () => void = () => {};
  private onChange: (innerText: string) => void;
  private oldValue: string;
  stateChanges = new Subject<void>();

  constructor(
    private dialog: MatDialog,
    @Optional() @Self() public ngControl: NgControl,
    @Optional() private _parentForm: NgForm,
    @Optional() private _parentFormGroup: FormGroupDirective
  ) {
    if (!ngControl) return;
    ngControl.valueAccessor = this;
    this.oldValue = ngControl.value;
  }

  ngOnInit(): void {
    if (!this.value) return;
    this.writeValue(this.value)
    this.stateChanges.next();
  }

  touched: boolean;
  errorState: boolean;
  autofilled?: boolean;
  userAriaDescribedBy?: string;

  static nextId = 0;

  @HostBinding() id = `content-editable-${ContenteditableComponent.nextId++}`;
  @Input()
  get placeholder() {
    return this._placeholder;
  }
  set placeholder(plh) {
    this._placeholder = plh;
    this.stateChanges.next();
  }
  private _placeholder: string;
  focused = false;

  onFocusIn(event: FocusEvent) {
    console.log(event);
    if (!this.focused) {
      this.focused = true;
      this.stateChanges.next();
      this._onFocus.emit();
    }
  }

  onFocusOut(event: FocusEvent) {
    if (!this.contenteditableEl.nativeElement.contains(event.relatedTarget as Element)) {
      this.touched = true;
      this.focused = false;
      this.onTouched();
      this.stateChanges.next();
      this._onBlur.emit();
    }
  }

  public focus() {
    if (this.disabled) return;
    const el = this.contenteditableEl.nativeElement;
    if (document.activeElement === el) return;
    const lastChild = el.childNodes?.[el.childNodes.length - 1];
    if (!lastChild) {
      el.focus();
      return;
    }
    const range = document.createRange()
    const sel = window.getSelection()
    
    range.setStart(lastChild, lastChild.textContent.length)
    range.collapse(true)
    
    sel.removeAllRanges()
    sel.addRange(range)
  }

  get empty() {
    const el = this.contenteditableEl.nativeElement
    return !el?.textContent;
  }

  @HostBinding('class.floating')
  get shouldLabelFloat() {
    return this.focused || !this.empty;
  }

  @Input()
  get required() {
    return this._required;
  }
  set required(req: boolean) {
    this._required = coerceBooleanProperty(req);
    this.stateChanges.next();
  }
  private _required = false;

  @Input()
  get disabled(): boolean { return this._disabled; }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
    this.stateChanges.next();
  }
  protected _disabled = false;

  ngDoCheck() {
    if (this.ngControl) {
      this.updateErrorState();
    }
  }

  private updateErrorState() {
    const parent = this._parentFormGroup || this._parentForm;

    const oldState = this.errorState;
    const newState = (this.ngControl?.invalid) && ((this.touched || this.ngControl?.control?.touched) || parent?.submitted);

    if (oldState !== newState) {
      this.errorState = newState;
      this.stateChanges.next();
    }
  }

  controlType = 'example-content-editable';

  setDescribedByIds(ids: string[]) {
    // const controlElement = this.contenteditableEl.nativeElement
    //   .querySelector('.example-tel-input-container')!;
    // controlElement.setAttribute('aria-describedby', ids.join(' '));
  }

  onContainerClick(event: MouseEvent) {
    if (this.disabled) return;
    if ((event.target as Element).tagName.toLowerCase() != 'input') { // TODO
      this.contenteditableEl.nativeElement.focus();
    }
  }

  writeValue(obj: string): void {
    this.contenteditableEl.nativeElement.innerHTML = obj || '';
  }
  registerOnChange(fn: () => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this._disabled = isDisabled;
  }

  protected onBlur() {
    if (!this.onTouched) return;
    this.onTouched();
  }

  protected onTool(tool: string, event: Event) {
    event.preventDefault();
    const simple = ['bold', 'italic', 'unlink', 'underline', 'removeFormat', 'increaseFontSize'];
    if (simple.includes(tool)) {
      document.execCommand(tool);
      return;
    }

    if (tool === 'createlink') {
      const link = prompt('Enter a link', 'https://');
      const reg = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&=]*)/;
      if (reg.test(link)) {
        document.execCommand('createlink', false, link);
      } else {
        this.dialog.open(
          DialogComponent,
          {
            data: {
              header: 'Warning',
              message: 'Wrong link',
              selects: ['Ok']
            }
          }
        );
      }
    }
    this.change();
  }

  protected setColor(color: Event | string) {
    clearInterval(this.interval);
    this.interval = setTimeout(() => {
      if (typeof color !== 'string') return;
      document.execCommand('foreColor', null, color);
      this.change();
    }, 300);
  }

  protected change() {
    const el = this.contenteditableEl.nativeElement;
    const newVal = el.textContent ? el.innerHTML : null;
    if (this.oldValue !== newVal) {
      this.oldValue = newVal;
      if (!this.onChange) return;
      this.onChange(newVal);
    }
  }

  ngOnDestroy(): void {
    this.stateChanges.complete();
  }
}
