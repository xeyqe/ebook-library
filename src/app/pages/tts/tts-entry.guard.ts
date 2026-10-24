import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanActivateFn } from '@angular/router';
import { catchError, defer, finalize, map, of, switchMap, take } from 'rxjs';
import { DialogComponent } from 'src/app/material/dialog/dialog.component';
import { SpeechPlaybackService } from 'src/app/services/speech-playback.service';

export const ttsEntryGuard: CanActivateFn = (route) => {
  const playback = inject(SpeechPlaybackService);
  const dialog = inject(MatDialog);
  const bookId = Number(route.paramMap.get('id'));
  if (!playback.isSpeaking() || playback.bookId === bookId) return true;

  const confirmation = dialog.open(DialogComponent, {
    data: {
      header: 'Switch book?',
      message: 'Another book is being read aloud. Opening this book will pause the previous reading.',
      selects: ['Continue', 'Cancel'],
    },
  });
  return confirmation.afterClosed().pipe(
    take(1),
    switchMap((choice) => {
      if (choice !== 0) return of(false);
      return defer(() => playback.pauseForBook(bookId)).pipe(
        map(() => true),
        catchError((error) => {
          console.error('Unable to pause the previous book', error);
          return of(false);
        }),
      );
    }),
    finalize(() => confirmation.close()),
  );
};
