import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import type { PromoCode } from '../../shared/models/promo-code.model';

@Injectable({ providedIn: 'root' })
export class PromoCodeService {
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

  validate(code: string): PromoCode | null {
    const normalized = code.trim().toUpperCase();

    return (
      this.codesSubject.value.find((promoCode) => promoCode.code.toUpperCase() === normalized && promoCode.isActive) || null
    );
  }

  getPromoCodes(): Observable<PromoCode[]> {
    return this.codes$;
  }

  createPromoCode(promo: Omit<PromoCode, 'id' | 'usedCount'> & { usedCount?: number }): Observable<PromoCode> {
    const nextId = Math.max(...this.codesSubject.value.map((item) => item.id), 0) + 1;
    const created: PromoCode = {
      ...promo,
      id: nextId,
      usedCount: promo.usedCount ?? 0
    };

    this.codesSubject.next([...this.codesSubject.value, created]);
    return of(created);
  }

  updatePromoCode(id: number, promo: Partial<PromoCode>): Observable<PromoCode> {
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
      throw new Error('Code promo introuvable.');
    }

    return of(updatedPromo);
  }

  deletePromoCode(id: number): Observable<{ success: true }> {
    this.codesSubject.next(this.codesSubject.value.filter((promoCode) => promoCode.id !== id));
    return of({ success: true });
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
