import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_SCRAPER_HTTP, WebScraperService } from './web-scraper.service';

describe('WebScraperService', () => {
  const get = vi.fn();
  let service: WebScraperService;
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ status: 200, data: '<html></html>' });
    TestBed.configureTestingModule({ providers: [{ provide: WEB_SCRAPER_HTTP, useValue: { get } }] });
    service = TestBed.inject(WebScraperService);
  });

  it('encodes search terms as one query parameter', async () => {
    await service.getBooksListOfAnyAuthor('A & B? #č');
    const options = get.mock.calls[0][0];
    expect(new URL(options.url).searchParams.get('q')).toBe('A & B? #č');
    expect(options).toMatchObject({ responseType: 'text', connectTimeout: 15000, readTimeout: 15000 });
  });

  it('rejects HTTP failures instead of reporting empty search results', async () => {
    get.mockResolvedValue({ status: 503, data: 'Unavailable' });
    await expect(service.getBooksListOfAnyAuthor('Book')).rejects.toThrow('503');
  });

  it('returns empty CBDB lists when optional search sections are absent', async () => {
    await expect(service.getCBDBBooks('Missing')).resolves.toEqual({ list: { main: [], foreign: [], partly: [] } });
  });

  it('keeps CBDB rows distinct and resolves links against the remote site', async () => {
    get.mockResolvedValue({
      status: 200,
      data: `<div id="search_result_box_books"><table class="search_graphic"><tr>
      <td><div class="search_graphic_content"><a href="/first">First</a><a href="/author-one">One</a></div></td>
      <td><div class="search_graphic_content"><a href="/second">Second</a><a href="/author-two">Two</a></div></td>
      </tr></table></div>`,
    });
    const result = await service.getCBDBBooks('Example');
    expect(result.list.main.map((book) => [book.title, book.link])).toEqual([
      ['First', 'https://www.cbdb.cz/first'],
      ['Second', 'https://www.cbdb.cz/second'],
    ]);
  });
});
