import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { inject } from '@angular/core';

import type { PromoCode } from '../../shared/models/promo-code.model';
import { environment } from '../../../environments/environment';

interface ApiPromoCode {
  id: number;
  code: string;
  discount: number;
  type: PromoCode['type'];
  min_order_amount: number;
  max_discount: number | null;
  valid_from: string;
  valid_to: string;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

@Injectable({ providedIn: 'root' })
export class PromoCodeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/promo-codes`;

  private readonly codesSubject = new BehaviorSubject<PromoCode[]>([
    {
      id: 1,
      code: 'WELCOME10',
      discount: 10,
      type: 'percentage',
      minOrderAmount: 0,
      maxDiscount: null,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2026-12-31'),
      usageLimit: 100,
      usedCount: 45,
      isActive: true
    },
    {
      id: 2,
      code: 'SAVE20',
      discount: 20,
      type: 'percentage',
      minOrderAmount: 50,
      maxDiscount: null,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2026-12-31'),
      usageLimit: 50,
      usedCount: 23,
      isActive: true
    }
  ]);

  readonly codes$ = this.codesSubject.asObservable();

  constructor() {
    this.refreshPromoCodesFromApi().subscribe();
  }

  private get authHeaders(): HttpHeaders {
    if (!this.isBrowser) {
      return new HttpHeaders();
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }

  private mapApiPromoCode(code: ApiPromoCode): PromoCode {
    return {
      id: code.id,
      code: code.code,
      discount: code.discount,
      type: code.type,
      minOrderAmount: code.min_order_amount,
      maxDiscount: code.max_discount,
      validFrom: new Date(code.valid_from),
      validTo: new Date(code.valid_to),
      usageLimit: code.usage_limit,
      usedCount: code.used_count,
      isActive: code.is_active
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
    }

    return 'Une erreur est survenue';
  }

  private refreshPromoCodesFromApi(): Observable<PromoCode[]> {
    if (!this.isBrowser) {
      return of(this.codesSubject.value);
    }

    return this.http.get<ApiPromoCode[]>(this.apiUrl).pipe(
      map((codes) => codes.map((code) => this.mapApiPromoCode(code))),
      tap((codes) => this.codesSubject.next(codes)),
      catchError(() => of(this.codesSubject.value))
    );
  }

  validate(code: string): PromoCode | null {
    // normalize: remove non-alphanumeric, trim and uppercase
    const normalized = code.replace(/[^a-z0-9]/gi, '').trim().toUpperCase();

    return this.codesSubject.value.find((promoCode) => {
      const stored = (promoCode.code ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
      return stored === normalized;
    }) || null;
  }

  getPromoCodes(): Observable<PromoCode[]> {
    return this.refreshPromoCodesFromApi();
  }

  createPromoCode(promo: Omit<PromoCode, 'id' | 'usedCount'> & { usedCount?: number }): Observable<PromoCode> {
    const payload = {
      code: promo.code,
      discount: promo.discount,
      type: promo.type,
      min_order_amount: promo.minOrderAmount,
      max_discount: promo.maxDiscount,
      valid_from: promo.validFrom,
      valid_to: promo.validTo,
      usage_limit: promo.usageLimit,
      used_count: promo.usedCount ?? 0,
      is_active: promo.isActive
    };

    return this.http.post<ApiPromoCode>(this.apiUrl, payload, { headers: this.authHeaders }).pipe(
      map((created) => this.mapApiPromoCode(created)),
      tap((created) => this.codesSubject.next([...this.codesSubject.value, created])),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        const nextId = Math.max(...this.codesSubject.value.map((item) => item.id), 0) + 1;
        const created: PromoCode = {
          ...promo,
          id: nextId,
          usedCount: promo.usedCount ?? 0
        };

        this.codesSubject.next([...this.codesSubject.value, created]);
        return of(created);
      })
    );
  }

  updatePromoCode(id: number, promo: Partial<PromoCode>): Observable<PromoCode> {
    const payload = {
      code: promo.code,
      discount: promo.discount,
      type: promo.type,
      min_order_amount: promo.minOrderAmount,
      max_discount: promo.maxDiscount,
      valid_from: promo.validFrom,
      valid_to: promo.validTo,
      usage_limit: promo.usageLimit,
      used_count: promo.usedCount,
      is_active: promo.isActive
    };

    return this.http.patch<ApiPromoCode>(`${this.apiUrl}/${id}`, payload, { headers: this.authHeaders }).pipe(
      map((updated) => this.mapApiPromoCode(updated)),
      tap((updatedPromo) =>
        this.codesSubject.next(this.codesSubject.value.map((item) => (item.id === id ? updatedPromo : item)))
      ),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        let updatedPromo: PromoCode | undefined;

        this.codesSubject.next(
          this.codesSubject.value.map((item) => {
            if (item.id !== id) {
              return item;
            }

            updatedPromo = {
              ...item,
              ...promo
            };

            return updatedPromo;
          })
        );

        if (!updatedPromo) {
          return throwError(() => new Error('Code promo introuvable.'));
        }

        return of(updatedPromo);
      })
    );
  }

  deletePromoCode(id: number): Observable<{ success: true }> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders }).pipe(
      tap(() => this.codesSubject.next(this.codesSubject.value.filter((promoCode) => promoCode.id !== id))),
      map(() => ({ success: true as const })),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        this.codesSubject.next(this.codesSubject.value.filter((promoCode) => promoCode.id !== id));
        return of({ success: true as const });
      })
    );
  }

  add(
    code: {
      code: string;
      discount: number;
      isActive: boolean;
    } & Partial<Omit<PromoCode, 'id' | 'code' | 'discount' | 'isActive'>>
  ): void {
    const nextId = Math.max(...this.codesSubject.value.map((item) => item.id), 0) + 1;
    this.codesSubject.next([
      ...this.codesSubject.value,
      {
        id: nextId,
        code: code.code,
        discount: code.discount,
        isActive: code.isActive,
        type: code.type ?? 'percentage',
        minOrderAmount: code.minOrderAmount ?? 0,
        maxDiscount: code.maxDiscount ?? null,
        validFrom: code.validFrom ?? new Date(),
        validTo: code.validTo ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usageLimit: code.usageLimit ?? null,
        usedCount: code.usedCount ?? 0
      }
    ]);
  }

  update(id: number, updates: Partial<PromoCode>): void {
    this.codesSubject.next(
      this.codesSubject.value.map((promoCode) =>
        promoCode.id === id
          ? {
              ...promoCode,
              ...updates
            }
          : promoCode
      )
    );
  }

  delete(id: number): void {
    this.codesSubject.next(this.codesSubject.value.filter((promoCode) => promoCode.id !== id));
  }
}
