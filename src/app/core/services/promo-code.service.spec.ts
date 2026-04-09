import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { PromoCodeService } from './promo-code.service';
import type { PromoCode } from '../../shared/models/promo-code.model';

describe('PromoCodeService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PromoCodeService] });
  });

  it('normalizes input and matches stored promo code', () => {
    const service = TestBed.inject(PromoCodeService);

    const codes: PromoCode[] = [
      {
        id: 1,
        code: 'PRMO50',
        discount: 50,
        type: 'percentage',
        minOrderAmount: 0,
        maxDiscount: null,
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 1000 * 60 * 60),
        usageLimit: null,
        usedCount: 0,
        isActive: true
      }
    ];

    // inject known codes into the private subject
    (service as any).codesSubject.next(codes);

    const found = service.validate('PRMO50 %');

    expect(found).not.toBeNull();
    expect(found?.code).toBe('PRMO50');
  });

  it('returns null for unknown promo code', () => {
    const service = TestBed.inject(PromoCodeService);
    (service as any).codesSubject.next([]);
    const found = service.validate('UNKNOWN');
    expect(found).toBeNull();
  });
});
