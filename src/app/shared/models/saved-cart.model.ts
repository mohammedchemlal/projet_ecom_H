import type { CartItem } from './cart-item.model';

export interface SavedCartPromo {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
}

export interface SavedCart {
  id: number;
  userId: number;
  name: string;
  items: CartItem[];
  promo: SavedCartPromo | null;
  createdAt: Date;
  updatedAt: Date;
}
