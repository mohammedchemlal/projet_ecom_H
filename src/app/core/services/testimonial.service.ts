import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import type { Testimonial } from '../../shared/models/product.model';

interface ApiTestimonial {
  id: number;
  customer_name: string;
  customer_image: string | null;
  role: string | null;
  rating: number;
  comment: string;
  is_active: boolean;
  created_at: string;
}

type TestimonialPayload = {
  customerName: string;
  customerImage: string;
  role?: string;
  rating: number;
  comment: string;
  isActive: boolean;
  sortOrder: number;
};

@Injectable({ providedIn: 'root' })
export class TestimonialService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/testimonials`;
  private readonly adminApiUrl = `${environment.apiUrl}/admin/testimonials`;

  getTestimonials(): Observable<Testimonial[]> {
    // Use public endpoint so testimonials load without authentication
    const publicUrl = `${this.apiUrl}/public`;
    return this.http.get<ApiTestimonial[]>(publicUrl).pipe(
      map((testimonials) => testimonials.map((item) => this.mapApiTestimonial(item))),
      catchError(() => of([]))
    );
  }

  getAdminTestimonials(): Observable<Testimonial[]> {
    const headers = this.getAuthHeaders();

    return this.http.get<ApiTestimonial[]>(this.adminApiUrl, { headers }).pipe(
      map((testimonials) => testimonials.map((item) => this.mapApiTestimonial(item))),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return throwError(() => new Error('Session expiree. Veuillez vous reconnecter.'));
        }

        return throwError(() => new Error('Impossible de charger les temoignages.'));
      })
    );
  }

  createTestimonial(payload: TestimonialPayload): Observable<Testimonial> {
    return this.http.post<ApiTestimonial>(this.adminApiUrl, this.toApiPayload(payload), { headers: this.getAuthHeaders() }).pipe(
      map((testimonial) => this.mapApiTestimonial(testimonial)),
      catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
    );
  }

  updateTestimonial(id: number, payload: Partial<TestimonialPayload>): Observable<Testimonial> {
    return this.http
      .patch<ApiTestimonial>(`${this.adminApiUrl}/${id}`, this.toApiPayload(payload), { headers: this.getAuthHeaders() })
      .pipe(
        map((testimonial) => this.mapApiTestimonial(testimonial)),
        catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
      );
  }

  deleteTestimonial(id: number): Observable<{ success: true }> {
    return this.http.delete<{ success: true }>(`${this.adminApiUrl}/${id}`, { headers: this.getAuthHeaders() }).pipe(
      catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
    );
  }

  private getAuthHeaders(): HttpHeaders {
    if (!isPlatformBrowser(this.platformId)) {
      return new HttpHeaders();
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }

  private toApiPayload(payload: Partial<TestimonialPayload>) {
    return {
      customer_name: payload.customerName,
      customer_image: payload.customerImage,
      role: payload.role ?? null,
      rating: payload.rating,
      comment: payload.comment,
      is_active: payload.isActive,
      sort_order: payload.sortOrder
    };
  }

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiError = error.error as { message?: string; errors?: Record<string, string[]> } | string | null;

      if (typeof apiError === 'string') {
        return apiError;
      }

      if (apiError?.message) {
        return apiError.message;
      }

      if (apiError?.errors) {
        const firstError = Object.values(apiError.errors)[0]?.[0];
        if (firstError) {
          return firstError;
        }
      }
    }

    return 'Une erreur est survenue';
  }

  private mapApiTestimonial(testimonial: ApiTestimonial): Testimonial {
    return {
      id: testimonial.id,
      customerName: testimonial.customer_name,
      customerImage: testimonial.customer_image ?? '/avatars/avatar-ink.svg',
      role: testimonial.role ?? undefined,
      rating: Number(testimonial.rating),
      comment: testimonial.comment,
      isActive: Boolean(testimonial.is_active),
      date: new Date(testimonial.created_at)
    };
  }
}
