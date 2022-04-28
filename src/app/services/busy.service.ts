import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BusyService {
  private _working: boolean;

  public get working(): boolean {
    return this._working;
  }

  public busy() {
    this._working = true;
  }

  public done() {
    this._working = false;
  }

}
