import { TestBed } from '@angular/core/testing';
import { WebView } from '@awesome-cordova-plugins/ionic-webview/ngx';
import { describe, expect, it, vi } from 'vitest';
import { DIRECTORY_FILESYSTEM, DirectoryService } from './directory.service';

describe('DirectoryService', () => {
  it('shares initialization and permits retry after storage becomes available', async () => {
    const getUri = vi
      .fn()
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValue({ uri: 'file:///storage' });
    TestBed.configureTestingModule({
      providers: [
        { provide: DIRECTORY_FILESYSTEM, useValue: { getUri } },
        { provide: WebView, useValue: { convertFileSrc: (uri: string) => `converted:${uri}` } },
      ],
    });
    const service = TestBed.inject(DirectoryService);
    await expect(service.initialize()).rejects.toThrow('Storage unavailable');
    expect(service.error()).toBe('Storage unavailable');
    const retry = service.initialize();
    expect(service.initialize()).toBe(retry);
    await retry;
    expect(service.imgPreLink()).toBe('converted:file:///storage');
    expect(service.error()).toBe('');
    expect(getUri).toHaveBeenCalledTimes(2);
  });
});
