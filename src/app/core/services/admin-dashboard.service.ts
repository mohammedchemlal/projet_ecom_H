import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, throwError, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

interface DashboardSummaryResponse {
  stats: {
    total_users: number;
    total_orders: number;
    total_revenue: number;
    total_products: number;
    pending_orders: number;
    delivered_orders: number;
    low_stock_products: number;
  };
  recent_orders: Array<{
    id: number;
    user_id: number;
    user_name: string;
    total: number;
    status: 'pending' | 'confirmed' | 'delivered';
    created_at: string | null;
  }>;
  monthly_sales: Array<{
    label: string;
    orders: number;
    revenue: number;
  }>;
  category_distribution: Array<{
    category: string;
    label: string;
    total: number;
  }>;
  low_stock_products_list: Array<{
    id: number;
    name: string;
    stock: number;
    category: string;
    image: string | null;
    is_active: boolean;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;
  // cached summary subject and in-flight request marker
  private readonly summarySubject = new BehaviorSubject<DashboardSummaryResponse | null>(null);
  readonly summary$ = this.summarySubject.asObservable();
  private inFlight$: Observable<DashboardSummaryResponse> | null = null;

  /**
   * Returns cached summary when available. Use `force=true` to bypass cache.
   */
  getSummary(force = false): Observable<DashboardSummaryResponse> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Session expiree. Veuillez vous reconnecter.'));
    }

    const cached = this.summarySubject.getValue();
    if (cached && !force) {
      return of(cached);
    }

    if (this.inFlight$ && !force) {
      return this.inFlight$;
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.inFlight$ = this.http.get<DashboardSummaryResponse>(this.apiUrl, { headers }).pipe(
      tap((res) => this.summarySubject.next(res)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return throwError(() => new Error('Session expiree. Veuillez vous reconnecter.'));
        }

        return throwError(() => new Error('Impossible de charger le dashboard.'));
      }),
      finalize(() => (this.inFlight$ = null)),
      shareReplay(1)
    );

    return this.inFlight$;
  }

  /** Force a refresh from server and update cache */
  refresh(): Observable<DashboardSummaryResponse> {
    return this.getSummary(true);
  }

  /** Invalidate cached summary */
  invalidate() {
    this.summarySubject.next(null);
  }

  /** Apply a partial update to the cached summary (useful after related CRUD ops) */
  updatePartial(patch: Partial<DashboardSummaryResponse>) {
    const current = this.summarySubject.getValue();
    if (!current) return;
    const merged = { ...current, ...patch } as DashboardSummaryResponse;
    // deep merge of stats if provided
    if (patch.stats) {
      merged.stats = { ...current.stats, ...patch.stats };
    }
    this.summarySubject.next(merged);
  }

  private getStoredToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }
}

export type { DashboardSummaryResponse };