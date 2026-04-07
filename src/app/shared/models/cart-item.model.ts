import type { Product } from './product.model';

export interface CartItem {
  productId: number;
  product: Product;
  quantity: number;
}
