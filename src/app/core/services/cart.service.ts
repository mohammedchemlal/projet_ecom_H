import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import type { CartItem } from '../../shared/models/cart-item.model';
import type { Product } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  private readonly cartCountSubject = new BehaviorSubject<number>(0);

  readonly cartItems$ = this.cartItemsSubject.asObservable();
  readonly cartCount$ = this.cartCountSubject.asObservable();

  constructor() {
    this.loadCart();
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

  getCartTotal(): number {
    return this.cartItemsSubject.value.reduce((total, item) => {
      const price = item.product.discountPrice || item.product.price;
      return total + price * item.quantity;
    }, 0);
  }

  clearCart(): void {
    this.saveCart([]);
  }
}
