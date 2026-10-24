import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';

export const DIRECTORY_FILESYSTEM = new InjectionToken<Pick<typeof Filesystem, 'getUri'>>('Directory filesystem', {
  providedIn: 'root',
  factory: () => ({ getUri: (options) => Filesystem.getUri(options) }),
});

@Injectable({ providedIn: 'root' })
export class DirectoryService {
  readonly dir = Directory.ExternalStorage;
  readonly imgPreLink = signal('');
  readonly error = signal('');
  private readonly webView = inject(WebView);
  private readonly filesystem = inject(DIRECTORY_FILESYSTEM);
  private initialization?: Promise<void>;

  constructor() {
    void this.initialize().catch((error) => console.error('Unable to resolve the library directory', error));
  }

  initialize(): Promise<void> {
    this.initialization ??= this.resolveDirectory().catch((error) => {
      this.initialization = undefined;
      this.error.set(error instanceof Error ? error.message : String(error));
      throw error;
    });
    return this.initialization;
  }

  private async resolveDirectory(): Promise<void> {
    const { uri } = await this.filesystem.getUri({ directory: this.dir, path: '' });
    this.imgPreLink.set(this.webView.convertFileSrc(uri));
    this.error.set('');
  }
}
