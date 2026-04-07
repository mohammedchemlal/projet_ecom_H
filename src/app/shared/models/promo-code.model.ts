export interface PromoCode {
  id: number;
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  minOrderAmount: number;
  maxDiscount: number | null;
  validFrom: Date;
  validTo: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}
