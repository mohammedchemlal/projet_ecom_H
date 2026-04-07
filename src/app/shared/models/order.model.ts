import type { CartItem } from './cart-item.model';

export interface Order {
  id: number;
  userId: number;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'delivered';
  address: string;
  phone: string;
  createdAt: Date;
}
