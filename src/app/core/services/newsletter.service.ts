import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

interface ApiNewsletterResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/newsletter`;

  subscribe(email: string): Observable<string> {
    return this.http.post<ApiNewsletterResponse>(this.apiUrl, { email }).pipe(
      map((resp) => resp.message),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          return throwError(() => new Error('Vous êtes déjà inscrit à la newsletter.'));
        }

        const apiError = error.error as { message?: string } | null;
        const msg = apiError?.message ?? 'Une erreur est survenue. Veuillez réessayer.';
        return throwError(() => new Error(msg));
      })
    );
  }
}
