import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { map, tap } from 'rxjs';

import { OrderService } from '../../core/services/order.service';
import type { Order } from '../../shared/models/order.model';

type OrderStatusOption = {
  label: string;
  value: Order['status'];
};

type OrderView = Order & {
  userName: string;
};

@Component({
  selector: 'app-admin-orders',
  imports: [ButtonModule, DialogModule, FormsModule, SelectModule, TableModule, TagModule],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminOrdersComponent {
  private readonly orderService = inject(OrderService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly selectedOrder = signal<OrderView | null>(null);
  readonly orderDetailVisible = signal(false);

  private readonly ordersSource = toSignal(
    this.orderService.getAllOrders().pipe(tap(() => this.loading.set(false))),
    { initialValue: [] as Order[] }
  );

  readonly statuses: OrderStatusOption[] = [
    { label: 'En attente', value: 'pending' },
    { label: 'Confirmee', value: 'confirmed' },
    { label: 'Livree', value: 'delivered' }
  ];

  readonly orders = computed<OrderView[]>(() => {
    const list = this.ordersSource();

    return list.map((order) => ({
      ...order,
      userName: this.getUserName(order.userId)
    }));
  });

  private readonly statusFilter = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const status = params.get('status');

        if (status === 'pending' || status === 'confirmed' || status === 'delivered') {
          return status as Order['status'];
        }

        return 'all';
      })
    ),
    { initialValue: 'all' as Order['status'] | 'all' }
  );

  readonly visibleOrders = computed<OrderView[]>(() => {
    const status = this.statusFilter();
    const list = this.orders();

    if (status === 'all') {
      return list;
    }

    return list.filter((order) => order.status === status);
  });

  private readonly currencyFormatter = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD'
  });

  updateStatus(order: OrderView, newStatus: Order['status']): void {
    if (order.status === newStatus) {
      return;
    }

    this.confirmationService.confirm({
      message: `Changer le statut de la commande #${order.id} en \"${this.getStatusLabel(newStatus)}\" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Confirmer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.orderService.updateOrderStatus(order.id, newStatus).subscribe(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Statut mis a jour'
          });
        });
      }
    });
  }

  viewOrderDetails(order: OrderView): void {
    this.selectedOrder.set(order);
    this.orderDetailVisible.set(true);
  }

  getStatusLabel(status: Order['status']): string {
    const found = this.statuses.find((item) => item.value === status);
    return found?.label ?? status;
  }

  getStatusSeverity(status: Order['status']): 'success' | 'info' | 'warn' | 'secondary' {
    const map: Record<Order['status'], 'success' | 'info' | 'warn'> = {
      pending: 'warn',
      confirmed: 'info',
      delivered: 'success'
    };

    return map[status] ?? 'secondary';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  getOrderItemPrice(orderItem: Order['items'][number]): number {
    return orderItem.product.discountPrice || orderItem.product.price;
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  getFormattedAddress(address: string): string {
    return address.replace(/\|/g, ', ');
  }

  private getUserName(userId: number): string {
    if (userId === 1) {
      return 'Client #1';
    }

    if (userId === 0) {
      return 'Invite';
    }

    return `Client #${userId}`;
  }
}
