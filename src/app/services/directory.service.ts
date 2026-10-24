import { Injectable, signal } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';

@Injectable({
  providedIn: 'root',
})
export class DirectoryService {
  private _dir: Directory;
  readonly imgPreLink = signal('');

  constructor(private webView: WebView) {
    this._dir = Directory.ExternalStorage;
    this.setImgPreLink();
  }

  public get dir(): Directory {
    return this._dir;
  }

  private async setImgPreLink() {
    const uri = await Filesystem.getUri({
      directory: this._dir,
      path: '',
    });
    this.imgPreLink.set(this.webView.convertFileSrc(uri.uri));
  }
}
