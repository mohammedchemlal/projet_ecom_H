import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import type { CartItem } from '../../shared/models/cart-item.model';
import type { Order } from '../../shared/models/order.model';
import type { User } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
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
      return;
    }

    this.persist(this.orders);
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
    const userOrders = this.orders.filter((order) => order.userId === currentUser?.id);
    return of(userOrders);
  }

  getOrderById(orderId: number): Observable<Order | undefined> {
    const order = this.orders.find((o) => o.id === orderId);
    return of(order);
  }

  getAllOrders(): Observable<Order[]> {
    return of(this.orders);
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

  createOrder(items: CartItem[], total: number, address: string, phone: string): Observable<Order> {
    const currentUser = this.getCurrentUser();
    const newOrder: Order = {
      id: Math.floor(Math.random() * 100000),
      userId: currentUser?.id ?? 0,
      items,
      total,
      status: 'pending',
      address,
      phone,
      createdAt: new Date()
    };

    this.persist([newOrder, ...this.orders]);
    return of(newOrder);
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

  placeOrder(userId: number, items: CartItem[], address: string, phone: string): Order {
    const total = items.reduce((sum, item) => {
      const price = item.product.discountPrice || item.product.price;
      return sum + price * item.quantity;
    }, 0);

    const order: Order = {
      id: Date.now(),
      userId,
      items,
      total,
      status: 'pending',
      address,
      phone,
      createdAt: new Date()
    };

    this.persist([order, ...this.ordersSubject.value]);
    return order;
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
    this.updateStatus(orderId, status);
    return of(this.ordersSubject.value.find((order) => order.id === orderId));
  }
}
