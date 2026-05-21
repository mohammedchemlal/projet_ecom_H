import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';

import type { Product } from '../../shared/models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/wishlist`;

  private wishlistSubject = new BehaviorSubject<Product[]>([]);
  public wishlist$: Observable<Product[]> = this.wishlistSubject.asObservable();
  public wishlistCount$ = new BehaviorSubject<number>(0);

  public wishlistItems$ = this.wishlist$;

  constructor() {
    this.loadWishlist();

    if (this.isBrowser) {
      this.authService.currentUser$
        .pipe(
          filter((user) => user !== null),
          switchMap(() => this.fetchWishlistFromApi())
        )
        .subscribe();
    }
  }

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private loadWishlist(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (token) {
      this.fetchWishlistFromApi().subscribe();
    } else {
      this.loadFromLocalStorage();
    }
  }

  private fetchWishlistFromApi(): Observable<Product[]> {
    return this.http.get<{ data: Product[] }>(this.apiUrl, { headers: this.authHeaders }).pipe(
      map((resp) => {
        const products = resp.data ?? [];
        this.mergeLocalWishlistWithServer(products);
        return products;
      }),
      tap((products) => {
        this.saveToLocalStorage(products);
        this.wishlistSubject.next(products);
        this.wishlistCount$.next(products.length);
      }),
      catchError(() => {
        this.loadFromLocalStorage();
        return of(this.wishlistSubject.value);
      })
    );
  }

  refreshFromApi(): Observable<Product[]> {
    return this.fetchWishlistFromApi();
  }

  private mergeLocalWishlistWithServer(serverProducts: Product[]): void {
    const localRaw = localStorage.getItem('wishlist');
    if (!localRaw) {
      return;
    }

    try {
      const localProducts = JSON.parse(localRaw) as Product[];
      const serverIds = new Set(serverProducts.map((p) => p.id));
      const toPush = localProducts.filter((p) => !serverIds.has(p.id));

      if (toPush.length === 0) {
        return;
      }

      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      if (!token) {
        return;
      }

      toPush.forEach((product) => {
        this.http.post<{ data: Product }>(this.apiUrl, { product_id: product.id }, { headers: this.authHeaders })
          .pipe(catchError(() => of(null)))
          .subscribe();
      });
    } catch {
      localStorage.removeItem('wishlist');
    }
  }

  private loadFromLocalStorage(): void {
    const saved = localStorage.getItem('wishlist');
    if (saved) {
      try {
        const items = JSON.parse(saved) as Product[];
        this.wishlistSubject.next(items);
        this.wishlistCount$.next(items.length);
      } catch {
        localStorage.removeItem('wishlist');
      }
    }
  }

  private saveToLocalStorage(items: Product[]): void {
    if (this.isBrowser) {
      localStorage.setItem('wishlist', JSON.stringify(items));
    }
  }

  private updateState(items: Product[]): void {
    this.saveToLocalStorage(items);
    this.wishlistSubject.next(items);
    this.wishlistCount$.next(items.length);
  }

  addToWishlist(product: Product): void {
    const current = this.wishlistSubject.value;
    if (current.some((item) => item.id === product.id)) {
      return;
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (token) {
      this.http.post<{ data: Product }>(this.apiUrl, { product_id: product.id }, { headers: this.authHeaders }).pipe(
        map((resp) => resp.data),
        catchError(() => of(product))
      ).subscribe((serverProduct) => {
        const updated = [...this.wishlistSubject.value, serverProduct];
        this.updateState(updated);
      });
    } else {
      const updated = [...current, product];
      this.updateState(updated);
    }
  }

  removeFromWishlist(productId: number): void {
    const current = this.wishlistSubject.value;
    const updated = current.filter((item) => item.id !== productId);
    this.updateState(updated);

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      this.http.delete(`${this.apiUrl}/${productId}`, { headers: this.authHeaders }).pipe(
        catchError(() => {
          this.loadFromLocalStorage();
          return of(null);
        })
      ).subscribe();
    }
  }

  isInWishlist(productId: number): boolean {
    return this.wishlistSubject.value.some((item) => item.id === productId);
  }

  clearWishlist(): void {
    const current = this.wishlistSubject.value;

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token && current.length > 0) {
      current.forEach((product) => {
        this.http.delete(`${this.apiUrl}/${product.id}`, { headers: this.authHeaders }).pipe(
          catchError(() => of(null))
        ).subscribe();
      });
    }

    this.updateState([]);
  }

  getWishlistCount(): number {
    return this.wishlistSubject.value.length;
  }

  getWishlistItems(): Product[] {
    return this.wishlistSubject.value;
  }

  add(product: Product): void {
    this.addToWishlist(product);
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
