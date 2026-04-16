import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import type { Product } from '../../shared/models/product.model';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private wishlistSubject = new BehaviorSubject<Product[]>([]);
  public wishlist$: Observable<Product[]> = this.wishlistSubject.asObservable();
  public wishlistCount$ = new BehaviorSubject<number>(0);

  // Keep compatibility with existing components already bound to wishlistItems$.
  public wishlistItems$ = this.wishlist$;

  constructor() {
    this.loadWishlist();
  }

  private loadWishlist(): void {
    if (!this.isBrowser) {
      return;
    }

    const savedWishlist = localStorage.getItem('wishlist');
    if (savedWishlist) {
      const items = JSON.parse(savedWishlist) as Product[];
      this.wishlistSubject.next(items);
      this.wishlistCount$.next(items.length);
    }
  }

  private saveWishlist(items: Product[]): void {
    if (this.isBrowser) {
      localStorage.setItem('wishlist', JSON.stringify(items));
    }

    this.wishlistSubject.next(items);
    this.wishlistCount$.next(items.length);
  }

  addToWishlist(product: Product): void {
    const currentItems = this.wishlistSubject.value;
    const exists = currentItems.some((item) => item.id === product.id);

    if (!exists) {
      this.saveWishlist([...currentItems, product]);
    }
  }

  removeFromWishlist(productId: number): void {
    const currentItems = this.wishlistSubject.value;
    this.saveWishlist(currentItems.filter((item) => item.id !== productId));
  }

  isInWishlist(productId: number): boolean {
    return this.wishlistSubject.value.some((item) => item.id === productId);
  }

  clearWishlist(): void {
    this.saveWishlist([]);
  }

  getWishlistCount(): number {
    return this.wishlistSubject.value.length;
  }

  getWishlistItems(): Product[] {
    return this.wishlistSubject.value;
  }

  // Compatibility aliases used elsewhere in the app.
  add(product: Product): void {
    if (!this.isInWishlist(product.id)) {
      const currentItems = this.wishlistSubject.value;
      this.saveWishlist([...currentItems, product]);
    }
  }

  remove(productId: number): void {
    this.removeFromWishlist(productId);
  }

  toggle(product: Product): void {
    const exists = this.isInWishlist(product.id);
    if (exists) {
      this.removeFromWishlist(product.id);
    } else {
      this.addToWishlist(product);
    }
  }

  clear(): void {
    this.clearWishlist();
  }
}
