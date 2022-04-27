import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NonusedPicsService {
  // tslint:disable-next-line: variable-name
  private _pics: string[];
  public get pics(): string[] {
    return this._pics;
  }
  public set pics(value: string[]) {
    this._pics = value;
  }
}
