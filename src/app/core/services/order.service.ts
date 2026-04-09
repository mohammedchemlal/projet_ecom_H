import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';

import type { CartItem } from '../../shared/models/cart-item.model';
import type { Order } from '../../shared/models/order.model';
import type { User } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';

interface ApiOrderItem {
  product_id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    discount_price: number | string | null;
    image: string | null;
    images: string[] | null;
    category: string;
    rating: number | string;
    review_count: number;
    stock: number;
    is_active: boolean;
    is_promotion: boolean;
    promotion_percentage: number | null;
    created_at: string;
  };
}

interface ApiOrder {
  id: number;
  user_id: number;
  items: ApiOrderItem[];
  total: number | string;
  discount_amount: number | string | null;
  promo_code: string | null;
  status: Order['status'];
  address: string;
  phone: string;
  created_at: string;
}

interface ApiOrderListResponse {
  data: ApiOrder[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

type OrdersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  status?: Order['status'] | 'all';
  dateFrom?: string;
  dateTo?: string;
};

type OrdersResult = {
  orders: Order[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
};

type AdminOrderPayload = {
  userId: number;
  total: number;
  status: Order['status'];
  address: string;
  phone: string;
};

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiUrl = `${environment.apiUrl}/orders`;
  private readonly ordersSubject = new BehaviorSubject<Order[]>([]);

  readonly orders$ = this.ordersSubject.asObservable();

  private orders: Order[] = [
    {
      id: 12345,
      userId: 1,
      items: [
        {
          productId: 1,
          product: {
            id: 1,
            name: 'Collier Elegance Doree',
            description: '',
            price: 89.99,
            discountPrice: 67.49,
            images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=100'],
            category: 'necklaces',
            rating: 4.8,
            reviewCount: 124,
            stock: 15,
            isActive: true,
            isPromotion: true,
            promotionPercentage: 25,
            createdAt: new Date()
          },
          quantity: 1
        }
      ],
      total: 67.49,
      status: 'delivered',
      address: '123 Rue de la Paix|Paris|75001|France',
      phone: '+33612345678',
      createdAt: new Date('2024-01-15')
    },
    {
      id: 12346,
      userId: 1,
      items: [
        {
          productId: 2,
          product: {
            id: 2,
            name: 'Bague Solitaire Argent',
            description: '',
            price: 149.99,
            images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=100'],
            category: 'rings',
            rating: 4.9,
            reviewCount: 89,
            stock: 23,
            isActive: true,
            isPromotion: false,
            createdAt: new Date()
          },
          quantity: 1
        }
      ],
      total: 149.99,
      status: 'confirmed',
      address: '123 Rue de la Paix|Paris|75001|France',
      phone: '+33612345678',
      createdAt: new Date('2024-02-20')
    }
  ];

  constructor() {
    if (!this.isBrowser) {
      this.ordersSubject.next(this.orders);
      return;
    }

    const storedOrders = localStorage.getItem('orders');

    if (storedOrders) {
      this.orders = (JSON.parse(storedOrders) as Order[]).map((order) => this.normalizeOrder(order));
      this.ordersSubject.next(this.orders);
      // Keep cache for fast first paint, then refresh with latest API values.
      this.refreshOrdersFromApi().subscribe();
      return;
    }

    this.persist(this.orders);
    this.refreshOrdersFromApi().subscribe();
  }

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }

  private mapApiOrder(order: ApiOrder): Order {
    return {
      id: order.id,
      userId: order.user_id,
      items: order.items.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description ?? '',
          price: Number(item.product.price),
          discountPrice: item.product.discount_price !== null ? Number(item.product.discount_price) : undefined,
          image: item.product.image ?? undefined,
          images: item.product.images ?? (item.product.image ? [item.product.image] : []),
          category: item.product.category,
          rating: Number(item.product.rating ?? 0),
          reviewCount: item.product.review_count ?? 0,
          stock: item.product.stock,
          isActive: Boolean(item.product.is_active),
          isPromotion: Boolean(item.product.is_promotion),
          promotionPercentage: item.product.promotion_percentage ?? undefined,
          createdAt: new Date(item.product.created_at)
        }
      })),
      total: Number(order.total),
      discountAmount: order.discount_amount !== null ? Number(order.discount_amount) : 0,
      promoCode: order.promo_code ?? undefined,
      status: order.status,
      address: order.address,
      phone: order.phone,
      createdAt: new Date(order.created_at)
    };
  }

  private refreshOrdersFromApi(): Observable<Order[]> {
    if (!this.isBrowser) {
      return of(this.ordersSubject.value);
    }

    return this.http.get<ApiOrder[]>(this.apiUrl, { headers: this.authHeaders }).pipe(
      map((orders) => orders.map((order) => this.mapApiOrder(order))),
      tap((orders) => this.persist(orders)),
      catchError(() => of(this.ordersSubject.value))
    );
  }

  private persist(orders: Order[]): void {
    this.orders = orders;
    this.ordersSubject.next(orders);

    if (this.isBrowser) {
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  }

  getUserOrders(): Observable<Order[]> {
    const currentUser = this.getCurrentUser();

    return this.refreshOrdersFromApi().pipe(
      map((orders) => orders.filter((order) => order.userId === currentUser?.id))
    );
  }

  getOrderById(orderId: number): Observable<Order | undefined> {
    const order = this.orders.find((o) => o.id === orderId);
    return of(order);
  }

  getAllOrders(): Observable<Order[]> {
    return this.refreshOrdersFromApi();
  }

  getAdminOrders(query: OrdersQuery = {}): Observable<OrdersResult> {
    let params = new HttpParams();

    if (query.page) {
      params = params.set('page', String(query.page));
    }

    if (query.perPage) {
      params = params.set('per_page', String(query.perPage));
    }

    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    if (query.status && query.status !== 'all') {
      params = params.set('status', query.status);
    }

    if (query.dateFrom) {
      params = params.set('date_from', query.dateFrom);
    }

    if (query.dateTo) {
      params = params.set('date_to', query.dateTo);
    }

    return this.http.get<ApiOrderListResponse>(this.apiUrl, { headers: this.authHeaders, params }).pipe(
      map((response) => ({
        orders: (response.data ?? []).map((order) => this.mapApiOrder(order)),
        meta: {
          currentPage: response.meta?.current_page ?? 1,
          lastPage: response.meta?.last_page ?? 1,
          perPage: response.meta?.per_page ?? (query.perPage ?? 10),
          total: response.meta?.total ?? (response.data?.length ?? 0)
        }
      }))
    );
  }

  getRecentOrders(limit = 5): Observable<Order[]> {
    return of(
      [...this.orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
    );
  }

  private normalizeOrder(order: Order): Order {
    return {
      ...order,
      createdAt: new Date(order.createdAt)
    };
  }

  createOrder(
    items: CartItem[],
    total: number,
    address: string,
    phone: string,
    promoCode?: string,
    discountAmount = 0
  ): Observable<Order> {
    const currentUser = this.getCurrentUser();
    const newOrder: Order = {
      id: Math.floor(Math.random() * 100000),
      userId: currentUser?.id ?? 0,
      items,
      total,
      discountAmount,
      promoCode,
      status: 'pending',
      address,
      phone,
      createdAt: new Date()
    };

    const payload = {
      user_id: newOrder.userId,
      items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity
      })),
      total,
      discount_amount: discountAmount,
      promo_code: promoCode ?? null,
      address,
      phone
    };

    return this.http.post<ApiOrder>(this.apiUrl, payload, { headers: this.authHeaders }).pipe(
      map((createdOrder) => this.mapApiOrder(createdOrder))
    );
  }

  private getCurrentUser(): User | null {
    if (!this.isBrowser) {
      return null;
    }

    const raw = localStorage.getItem('currentUser');
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as User;
  }

  placeOrder(
    userId: number,
    items: CartItem[],
    address: string,
    phone: string,
    totalOverride?: number,
    promoCode?: string,
    discountAmount = 0
  ): Observable<Order> {
    const itemsTotal = items.reduce((sum, item) => {
      const price = item.product.discountPrice || item.product.price;
      return sum + price * item.quantity;
    }, 0);

    const total = totalOverride ?? itemsTotal;

    const order: Order = {
      id: Date.now(),
      userId,
      items,
      total,
      discountAmount,
      promoCode,
      status: 'pending',
      address,
      phone,
      createdAt: new Date()
    };

    // persist optimistically
    this.persist([order, ...this.ordersSubject.value]);

    // call API and replace optimistic order on success or rollback on error
    return this.createOrder(items, total, address, phone, promoCode, discountAmount).pipe(
      tap((createdOrder) => {
        this.persist(
          this.ordersSubject.value.map((existingOrder) =>
            existingOrder.id === order.id
              ? {
                  ...createdOrder,
                  userId
                }
              : existingOrder
          )
        );
      }),
      catchError((err) => {
        // rollback optimistic order
        this.persist(this.ordersSubject.value.filter((existingOrder) => existingOrder.id !== order.id));
        return throwError(() => err);
      })
    );
  }

  updateStatus(orderId: number, status: Order['status']): void {
    this.persist(
      this.ordersSubject.value.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status
            }
          : order
      )
    );
  }

  updateOrderStatus(orderId: number, status: Order['status']): Observable<Order | undefined> {
    return this.http.patch<ApiOrder>(`${this.apiUrl}/${orderId}`, { status }, { headers: this.authHeaders }).pipe(
      map((updatedOrder) => this.mapApiOrder(updatedOrder)),
      tap((mappedOrder) => {
        this.persist(this.ordersSubject.value.map((order) => (order.id === orderId ? mappedOrder : order)));
      }),
      map((mappedOrder) => mappedOrder),
      catchError(() => {
        this.updateStatus(orderId, status);
        return of(this.ordersSubject.value.find((order) => order.id === orderId));
      })
    );
  }

  deleteOrder(orderId: number): Observable<{ success: true }> {
    return this.http.delete<{ success: true }>(`${this.apiUrl}/${orderId}`, { headers: this.authHeaders }).pipe(
      tap(() => this.persist(this.ordersSubject.value.filter((order) => order.id !== orderId)))
    );
  }

  createAdminOrder(payload: AdminOrderPayload): Observable<Order> {
    const body = {
      user_id: payload.userId,
      items: [],
      total: payload.total,
      discount_amount: 0,
      promo_code: null,
      status: payload.status,
      address: payload.address,
      phone: payload.phone
    };

    return this.http.post<ApiOrder>(this.apiUrl, body, { headers: this.authHeaders }).pipe(
      map((createdOrder) => this.mapApiOrder(createdOrder)),
      tap((createdOrder) => this.persist([createdOrder, ...this.ordersSubject.value]))
    );
  }
}
