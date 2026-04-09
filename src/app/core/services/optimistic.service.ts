import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, tap, throwError } from 'rxjs';

/**
 * Utility helpers for optimistic updates on BehaviorSubject-backed lists.
 * Provides generic create/update/delete helpers that apply a local change
 * immediately and revert if the API call fails.
 */
@Injectable({ providedIn: 'root' })
export class OptimisticService {
  optimisticCreate<T extends { id: number }>(
    subject: BehaviorSubject<T[]>,
    tempItem: T,
    apiCall$: Observable<T>
  ): Observable<T> {
    // apply optimistic
    subject.next([...subject.value, tempItem]);

    return apiCall$.pipe(
      tap((created) => {
        subject.next(subject.value.map((item) => (item.id === tempItem.id ? created : item)));
      }),
      catchError((err) => {
        // rollback
        subject.next(subject.value.filter((item) => item.id !== tempItem.id));
        return throwError(() => err);
      })
    );
  }

  optimisticUpdate<T extends { id: number }>(
    subject: BehaviorSubject<T[]>,
    id: number,
    patch: Partial<T>,
    apiCall$: Observable<T>
  ): Observable<T> {
    const previous = subject.value;
    const before = previous.find((p) => p.id === id);
    if (!before) {
      return apiCall$;
    }

    // apply optimistic
    subject.next(previous.map((p) => (p.id === id ? { ...p, ...patch } : p)));

    return apiCall$.pipe(
      tap((updated) => subject.next(subject.value.map((p) => (p.id === id ? updated : p)))),
      catchError((err) => {
        // rollback
        subject.next(previous);
        return throwError(() => err);
      })
    );
  }

  optimisticDelete<T extends { id: number }>(subject: BehaviorSubject<T[]>, id: number, apiCall$: Observable<unknown>): Observable<unknown> {
    const previous = subject.value;

    // apply optimistic
    subject.next(previous.filter((p) => p.id !== id));

    return apiCall$.pipe(
      catchError((err) => {
        // rollback
        subject.next(previous);
        return throwError(() => err);
      })
    );
  }
}
