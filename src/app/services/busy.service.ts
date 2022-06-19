import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BusyService {
  private _working: boolean;
  private _inBg: boolean;
  private _isSpeaking: boolean;

  public get working(): boolean {
    return this._working;
  }

  public busy() {
    this._working = true;
  }

  public done() {
    this._working = false;
  }

  public get inBg(): boolean {
    return this._inBg;
  }
  public set inBg(value: boolean) {
    this._inBg = value;
  }

  public get isSpeaking(): boolean {
    return this._isSpeaking;
  }
  public set isSpeaking(value: boolean) {
    this._isSpeaking = value;
  }

}
