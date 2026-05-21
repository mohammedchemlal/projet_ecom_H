import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { SavedCart } from '../../shared/models/saved-cart.model';
import type { CartItem } from '../../shared/models/cart-item.model';
import type { CartPromo } from './cart.service';
import { environment } from '../../../environments/environment';

interface ApiSavedCart {
  id: number;
  user_id: number;
  name: string;
  items: CartItem[];
  promo: { code: string; discount: number; type: string } | null;
  created_at: string;
  updated_at: string;
}

interface ApiSavedCartListResponse {
  data: ApiSavedCart[];
}

interface ApiSavedCartResponse {
  data: ApiSavedCart;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SavedCartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/saved-carts`;

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private mapApiCart(api: ApiSavedCart): SavedCart {
    return {
      id: api.id,
      userId: api.user_id,
      name: api.name,
      items: api.items ?? [],
      promo: api.promo as SavedCart['promo'],
      createdAt: new Date(api.created_at),
      updatedAt: new Date(api.updated_at),
    };
  }

  getAll(): Observable<SavedCart[]> {
    return this.http.get<ApiSavedCartListResponse>(this.apiUrl, { headers: this.authHeaders }).pipe(
      map((resp) => (resp.data ?? []).map((c) => this.mapApiCart(c)))
    );
  }

  getById(id: number): Observable<SavedCart> {
    return this.http.get<ApiSavedCartResponse>(`${this.apiUrl}/${id}`, { headers: this.authHeaders }).pipe(
      map((resp) => this.mapApiCart(resp.data))
    );
  }

  save(name: string, items: CartItem[], promo: CartPromo | null): Observable<SavedCart> {
    return this.http.post<ApiSavedCartResponse>(
      this.apiUrl,
      { name, items, promo },
      { headers: this.authHeaders }
    ).pipe(
      map((resp) => this.mapApiCart(resp.data))
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders });
  }
}
