import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRouteSnapshot, RouterStateSnapshot, convertToParamMap } from '@angular/router';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { SpeechPlaybackService } from 'src/app/services/speech-playback.service';
import { ttsEntryGuard } from './tts-entry.guard';

describe('TTS entry guard', () => {
  let playback: { bookId: number; isSpeaking: ReturnType<typeof vi.fn>; pauseForBook: ReturnType<typeof vi.fn> };
  let choices: Subject<number | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let close: ReturnType<typeof vi.fn>;

  function enter(bookId = 7) {
    return TestBed.runInInjectionContext(() =>
      ttsEntryGuard(
        { paramMap: convertToParamMap({ id: String(bookId) }) } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    ) as boolean | Observable<boolean>;
  }

  beforeEach(() => {
    choices = new Subject();
    close = vi.fn();
    playback = {
      bookId: 42,
      isSpeaking: vi.fn().mockReturnValue(true),
      pauseForBook: vi.fn().mockResolvedValue(undefined),
    };
    dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => choices, close }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: SpeechPlaybackService, useValue: playback },
        { provide: MatDialog, useValue: dialog },
      ],
    });
  });

  it('allows entry without a dialog when nothing is playing', () => {
    playback.isSpeaking.mockReturnValue(false);
    expect(enter()).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(playback.pauseForBook).not.toHaveBeenCalled();
  });

  it('keeps the same book playing without a dialog', () => {
    expect(enter(42)).toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(playback.pauseForBook).not.toHaveBeenCalled();
  });

  it('waits for confirmation and finishes pausing before allowing entry', async () => {
    let finishPause: () => void;
    playback.pauseForBook.mockReturnValue(
      new Promise<void>((resolve) => {
        finishPause = resolve;
      }),
    );
    let entered = false;
    const result = firstValueFrom(enter() as Observable<boolean>).then((allowed) => {
      entered = allowed;
      return allowed;
    });
    expect(dialog.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ message: expect.stringContaining('pause') }),
      }),
    );
    expect(playback.pauseForBook).not.toHaveBeenCalled();
    choices.next(0);
    expect(playback.pauseForBook).toHaveBeenCalledWith(7);
    expect(entered).toBe(false);
    finishPause();
    expect(await result).toBe(true);
  });

  it.each([1, undefined])('cancels entry and keeps reading when the dialog returns %s', async (choice) => {
    const result = firstValueFrom(enter() as Observable<boolean>);
    choices.next(choice);
    expect(await result).toBe(false);
    expect(playback.pauseForBook).not.toHaveBeenCalled();
  });

  it('closes the dialog without pausing when navigation is cancelled', () => {
    const navigation = (enter() as Observable<boolean>).subscribe();
    navigation.unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
    expect(playback.pauseForBook).not.toHaveBeenCalled();
  });

  it('blocks entry when pausing fails', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    playback.pauseForBook.mockRejectedValue(new Error('Pause failed'));
    const result = firstValueFrom(enter() as Observable<boolean>);
    choices.next(0);
    expect(await result).toBe(false);
    errorLog.mockRestore();
  });
});
