import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContenteditableComponent } from './contenteditable.component';

@Component({
  imports: [ReactiveFormsModule, MatFormFieldModule, ContenteditableComponent],
  template: `
    <form [formGroup]="form">
      <mat-form-field>
        <mat-label>Title</mat-label>
        <app-contenteditable
          formControlName="title"
          required
          placeholder="Enter a title"
          aria-describedby="custom-help"
          (_onFocus)="focusCount = focusCount + 1"
          (_onBlur)="blurCount = blurCount + 1" />
        <mat-hint>Help</mat-hint>
        <mat-error>Required</mat-error>
      </mat-form-field>
    </form>
    <button type="button">Next</button>
  `,
})
class TestHostComponent {
  readonly form = new FormGroup({ title: new FormControl('<b>Initial</b>', Validators.required) });
  focusCount = 0;
  blurCount = 0;
}

function input(editor: HTMLElement, html: string, isComposing = false): void {
  editor.innerHTML = html;
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing }));
}

function paste(editor: HTMLElement, text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  editor.dispatchEvent(event);
  return event;
}

describe('ContenteditableComponent', () => {
  let fixture: ComponentFixture<ContenteditableComponent>;
  let component: ContenteditableComponent;
  let editor: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ContenteditableComponent] });
    fixture = TestBed.createComponent(ContenteditableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    editor = fixture.nativeElement.querySelector('[role="textbox"]');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
  });

  it('renders display-only value changes, numeric zero and resets', () => {
    fixture.componentRef.setInput('value', '<b>First</b>');
    fixture.detectChanges();
    expect(editor.innerHTML).toBe('<b>First</b>');
    fixture.componentRef.setInput('value', 0);
    fixture.detectChanges();
    expect(editor.textContent).toBe('0');
    expect(component.empty()).toBe(false);
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();
    expect(editor.innerHTML).toBe('');
    expect(component.empty()).toBe(true);
  });

  it('does not report model writes as user edits', () => {
    const change = vi.fn();
    component.registerOnChange(change);
    component.writeValue('<em>Model</em>');
    expect(editor.innerHTML).toBe('<em>Model</em>');
    expect(change).not.toHaveBeenCalled();
  });

  it('reports input changes once, including clearing the field', () => {
    const change = vi.fn();
    component.registerOnChange(change);
    input(editor, 'Typed');
    input(editor, 'Typed');
    input(editor, '<br>');
    expect(change.mock.calls).toEqual([['Typed'], [null]]);
    expect(component.empty()).toBe(true);
  });

  it('waits for IME composition to finish before updating the form', () => {
    const change = vi.fn();
    component.registerOnChange(change);
    editor.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    input(editor, '日本', true);
    expect(change).not.toHaveBeenCalled();
    editor.dispatchEvent(new Event('compositionend', { bubbles: true }));
    input(editor, '日本');
    expect(change).toHaveBeenCalledExactlyOnceWith('日本');
  });

  it('pastes literal plain text at the selection and immediately reports the edit', () => {
    const change = vi.fn();
    component.writeValue('Before after');
    component.registerOnChange(change);
    editor.focus();
    const range = document.createRange();
    range.setStart(editor.firstChild, 7);
    range.setEnd(editor.firstChild, 12);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const event = paste(editor, '<b>literal</b>\n  spaces');
    expect(event.defaultPrevented).toBe(true);
    expect(editor.textContent).toBe('Before <b>literal</b>\n  spaces');
    expect(editor.querySelector('b')).toBeNull();
    expect(change).toHaveBeenCalledExactlyOnceWith('Before &lt;b&gt;literal&lt;/b&gt;\n  spaces');
  });

  it('sanitizes stored rich text while preserving supported formatting', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    component.writeValue('<b>Safe</b><script>alert(1)</script><img src="x" onerror="alert(1)">');
    expect(editor.querySelector('b')?.textContent).toBe('Safe');
    expect(editor.querySelector('script')).toBeNull();
    expect(editor.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });

  it('focuses after nested markup and keeps the existing selection when already focused', () => {
    component.writeValue('<b>Nested <em>text</em></b>');
    expect(() => component.focus()).not.toThrow();
    expect(document.activeElement).toBe(editor);
    const selection = document.getSelection();
    expect(selection.anchorNode).toBe(editor);
    expect(selection.anchorOffset).toBe(editor.childNodes.length);
    const range = document.createRange();
    range.setStart(editor.querySelector('em').firstChild, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    component.focus();
    expect(selection.anchorOffset).toBe(1);
    expect(selection.anchorNode).toBe(editor.querySelector('em').firstChild);
  });

  it('blocks focus, edits and paste when disabled', () => {
    const change = vi.fn();
    component.writeValue('Saved');
    component.registerOnChange(change);
    fixture.componentRef.setInput('disabled', '');
    fixture.detectChanges();
    expect(editor.getAttribute('contenteditable')).toBe('false');
    expect(editor.getAttribute('tabindex')).toBe('-1');
    component.focus();
    expect(document.activeElement).not.toBe(editor);
    input(editor, 'Unexpected edit');
    paste(editor, 'Unexpected paste');
    expect(editor.textContent).toBe('Saved');
    expect(change).not.toHaveBeenCalled();
  });
});

describe('ContenteditableComponent form and Material integration', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: ContenteditableComponent;
  let editor: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.query(By.directive(ContenteditableComponent)).componentInstance;
    editor = fixture.nativeElement.querySelector('[role="textbox"]');
  });

  it('renders initial and subsequent form values and propagates input without key events', () => {
    expect(editor.innerHTML).toBe('<b>Initial</b>');
    input(editor, 'Edited');
    expect(host.form.controls.title.value).toBe('Edited');
    expect(host.form.controls.title.dirty).toBe(true);
    host.form.controls.title.setValue('<em>Replacement</em>');
    expect(editor.innerHTML).toBe('<em>Replacement</em>');
    host.form.reset();
    expect(editor.innerHTML).toBe('');
  });

  it('marks the control touched and emits blur once when focus leaves', () => {
    const touched = vi.fn();
    component.registerOnTouched(() => {
      touched();
      host.form.controls.title.markAsTouched();
    });
    editor.focus();
    expect(host.focusCount).toBe(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-form-field').classList.contains('mat-focused')).toBe(true);
    fixture.nativeElement.querySelector('button').focus();
    fixture.detectChanges();
    expect(host.blurCount).toBe(1);
    expect(fixture.nativeElement.querySelector('mat-form-field').classList.contains('mat-focused')).toBe(false);
    expect(touched).toHaveBeenCalledTimes(1);
    expect(host.form.controls.title.touched).toBe(true);
  });

  it('keeps focus inside rich-text descendants without marking the control touched', () => {
    editor.focus();
    editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: editor.querySelector('b') }));
    expect(component.focused()).toBe(true);
    expect(host.form.controls.title.touched).toBe(false);
    expect(host.blurCount).toBe(0);
  });

  it('updates disabled state from the form', () => {
    host.form.disable();
    fixture.detectChanges();
    expect(editor.getAttribute('aria-disabled')).toBe('true');
    expect(editor.getAttribute('contenteditable')).toBe('false');
    host.form.enable();
    fixture.detectChanges();
    expect(editor.getAttribute('aria-disabled')).toBe('false');
    expect(editor.getAttribute('contenteditable')).toBe('true');
  });

  it('connects the label, required state, hints and validation errors to the textbox', () => {
    fixture.detectChanges();
    const label: HTMLElement = fixture.nativeElement.querySelector('mat-label');
    expect(editor.getAttribute('aria-labelledby')).toBe(label.closest('label').id);
    expect(editor.getAttribute('aria-required')).toBe('true');
    expect(editor.getAttribute('aria-placeholder')).toBe('Enter a title');
    const hint: HTMLElement = fixture.nativeElement.querySelector('mat-hint');
    expect(editor.getAttribute('aria-describedby').split(' ')).toEqual(
      expect.arrayContaining(['custom-help', hint.id]),
    );
    host.form.controls.title.setValue('');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(component.errorState()).toBe(true);
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    const error: HTMLElement = fixture.nativeElement.querySelector('mat-error');
    expect(editor.getAttribute('aria-describedby').split(' ')).toContain(error.id);
  });
});
