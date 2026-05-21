import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import type { CartItem } from '../../shared/models/cart-item.model';
import type { Product } from '../../shared/models/product.model';

export interface CartPromo {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  private readonly cartCountSubject = new BehaviorSubject<number>(0);
  private readonly promoSubject = new BehaviorSubject<CartPromo | null>(null);

  readonly cartItems$ = this.cartItemsSubject.asObservable();
  readonly cartCount$ = this.cartCountSubject.asObservable();
  readonly appliedPromo$ = this.promoSubject.asObservable();

  constructor() {
    this.loadCart();
    this.loadPromo();
  }

  private loadCart(): void {
    if (!this.isBrowser) {
      return;
    }

    const savedCart = localStorage.getItem('cart');

    if (savedCart) {
      const items = JSON.parse(savedCart) as CartItem[];
      this.cartItemsSubject.next(items);
      this.updateCartCount(items);
    }
  }

  private loadPromo(): void {
    if (!this.isBrowser) {
      return;
    }

    const savedPromo = localStorage.getItem('cartPromo');

    if (!savedPromo) {
      return;
    }

    try {
      const promo = JSON.parse(savedPromo) as CartPromo;

      if (
        promo &&
        typeof promo.code === 'string' &&
        typeof promo.discount === 'number' &&
        (promo.type === 'percentage' || promo.type === 'fixed')
      ) {
        this.promoSubject.next(promo);
      }
    } catch {
      localStorage.removeItem('cartPromo');
    }
  }

  private saveCart(items: CartItem[]): void {
    if (this.isBrowser) {
      localStorage.setItem('cart', JSON.stringify(items));
    }

    this.cartItemsSubject.next(items);
    this.updateCartCount(items);
  }

  private updateCartCount(items: CartItem[]): void {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    this.cartCountSubject.next(count);
  }

  private savePromo(promo: CartPromo | null): void {
    if (this.isBrowser) {
      if (promo) {
        localStorage.setItem('cartPromo', JSON.stringify(promo));
      } else {
        localStorage.removeItem('cartPromo');
      }
    }

    this.promoSubject.next(promo);
  }

  addToCart(product: Product, quantity = 1): void {
    const currentItems = this.cartItemsSubject.value;
    const existingItem = currentItems.find((item) => item.productId === product.id);

    if (existingItem) {
      existingItem.quantity += quantity;
      this.saveCart([...currentItems]);
      return;
    }

    this.saveCart([...currentItems, { productId: product.id, product, quantity }]);
  }

  removeFromCart(productId: number): void {
    const currentItems = this.cartItemsSubject.value;
    this.saveCart(currentItems.filter((item) => item.productId !== productId));
  }

  updateQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItemsSubject.value;
    const item = currentItems.find((cartItem) => cartItem.productId === productId);

    if (item) {
      item.quantity = quantity;
      this.saveCart([...currentItems]);
    }
  }

  getCartSubtotal(): number {
    return this.cartItemsSubject.value.reduce((total, item) => {
      const price = item.product.discountPrice || item.product.price;
      return total + price * item.quantity;
    }, 0);
  }

  getAppliedPromo(): CartPromo | null {
    return this.promoSubject.value;
  }

  setAppliedPromo(promo: CartPromo): void {
    this.savePromo(promo);
  }

  clearPromoCode(): void {
    this.savePromo(null);
  }

  getCartDiscountAmount(): number {
    const promo = this.promoSubject.value;

    if (!promo) {
      return 0;
    }

    const subtotal = this.getCartSubtotal();

    if (promo.type === 'fixed') {
      return Math.min(subtotal, promo.discount);
    }

    return (subtotal * promo.discount) / 100;
  }

  getCartTotal(): number {
    return Math.max(this.getCartSubtotal() - this.getCartDiscountAmount(), 0);
  }

  applyPromoFromSaved(promo: CartPromo): void {
    this.savePromo(promo);
  }

  clearCart(): void {
    this.saveCart([]);
    this.clearPromoCode();
  }
}
