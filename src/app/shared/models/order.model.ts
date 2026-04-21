import type { CartItem } from './cart-item.model';

export interface Order {
  id: number;
  userId: number;
  customerName?: string | null;
  customerEmail?: string | null;
  items: CartItem[];
  total: number;
  discountAmount?: number;
  promoCode?: string;
  status: 'pending' | 'confirmed' | 'delivered';
  address: string;
  phone: string;
  createdAt: Date;
}
