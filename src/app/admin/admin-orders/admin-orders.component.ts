import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { OrderService } from '../../core/services/order.service';
import type { Order } from '../../shared/models/order.model';

type OrderStatusOption = {
  label: string;
  value: Order['status'];
};

type OrderView = Order & {
  userName: string;
};

type PeriodFilter = 'all' | 'today' | '7d' | '30d';

@Component({
  selector: 'app-admin-orders',
  imports: [
    ButtonModule,
    DialogModule,
    FormsModule,
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    SelectModule,
    TableModule,
    TagModule
  ],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminOrdersComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly orders = signal<OrderView[]>([]);
  readonly selectedOrder = signal<OrderView | null>(null);
  readonly orderDetailVisible = signal(false);
  readonly createOrderVisible = signal(false);
  readonly searchTerm = signal('');
  readonly statusFilter = signal<Order['status'] | 'all'>('all');
  readonly periodFilter = signal<PeriodFilter>('all');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly currentPage = signal(1);
  readonly rows = signal(10);
  readonly totalRecords = signal(0);

  readonly statuses: OrderStatusOption[] = [
    { label: 'En attente', value: 'pending' },
    { label: 'Confirmee', value: 'confirmed' },
    { label: 'Livree', value: 'delivered' }
  ];

  readonly statusFilterOptions: Array<{ label: string; value: Order['status'] | 'all' }> = [
    { label: 'Tous les statuts', value: 'all' },
    ...this.statuses
  ];

  readonly periodOptions: Array<{ label: string; value: PeriodFilter }> = [
    { label: 'Toute période', value: 'all' },
    { label: "Aujourd'hui", value: 'today' },
    { label: '7 derniers jours', value: '7d' },
    { label: '30 derniers jours', value: '30d' }
  ];

  readonly createOrderForm = this.fb.nonNullable.group({
    userId: [1, [Validators.required, Validators.min(1)]],
    total: [0, [Validators.required, Validators.min(0)]],
    status: ['pending' as Order['status'], Validators.required],
    address: ['', [Validators.required, Validators.minLength(5)]],
    phone: ['', [Validators.required, Validators.minLength(8)]]
  });

  private readonly currencyFormatter = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD'
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);

    this.orderService
      .getAdminOrders({
        page: this.currentPage(),
        perPage: this.rows(),
        search: this.searchTerm(),
        status: this.statusFilter(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo()
      })
      .subscribe({
        next: ({ orders, meta }) => {
          this.orders.set(
            orders.map((order) => ({
              ...order,
              userName: this.getUserName(order.userId)
            }))
          );
          this.totalRecords.set(meta.total);
          this.rows.set(meta.perPage);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.orders.set([]);
          this.totalRecords.set(0);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: error.message
          });
        }
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const nextRows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    this.rows.set(nextRows);
    this.currentPage.set(Math.floor(first / nextRows) + 1);
    this.loadOrders();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
    this.loadOrders();
  }

  onStatusFilterChange(value: Order['status'] | 'all'): void {
    this.statusFilter.set(value);
    this.currentPage.set(1);
    this.loadOrders();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.periodFilter.set('all');
    this.currentPage.set(1);
    this.loadOrders();
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.periodFilter.set('all');
    this.currentPage.set(1);
    this.loadOrders();
  }

  onPeriodChange(value: PeriodFilter): void {
    this.periodFilter.set(value);
    const now = new Date();

    const toIsoDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    if (value === 'all') {
      this.dateFrom.set('');
      this.dateTo.set('');
    } else if (value === 'today') {
      const today = toIsoDate(now);
      this.dateFrom.set(today);
      this.dateTo.set(today);
    } else {
      const days = value === '7d' ? 7 : 30;
      const from = new Date(now);
      from.setDate(now.getDate() - days + 1);
      this.dateFrom.set(toIsoDate(from));
      this.dateTo.set(toIsoDate(now));
    }

    this.currentPage.set(1);
    this.loadOrders();
  }

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
        this.orderService.updateOrderStatus(order.id, newStatus).subscribe((updatedOrder) => {
          if (updatedOrder) {
            this.upsertOrderInView(updatedOrder);
          }

          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Statut mis a jour'
          });
        });
      }
    });
  }

  deleteOrder(order: OrderView): void {
    this.confirmationService.confirm({
      message: `Supprimer la commande #${order.id} ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.orderService.deleteOrder(order.id).subscribe({
          next: () => {
            this.removeOrderFromView(order.id);
            this.messageService.add({
              severity: 'success',
              summary: 'Succes',
              detail: 'Commande supprimee'
            });
          },
          error: (error: Error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: error.message
            });
          }
        });
      }
    });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.periodFilter.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
    this.loadOrders();
  }

  viewOrderDetails(order: OrderView): void {
    this.selectedOrder.set(order);
    this.orderDetailVisible.set(true);
  }

  openCreateOrderDialog(): void {
    this.createOrderForm.reset({
      userId: 1,
      total: 0,
      status: 'pending',
      address: '',
      phone: ''
    });

    this.createOrderVisible.set(true);
  }

  saveCreatedOrder(): void {
    if (this.createOrderForm.invalid) {
      this.createOrderForm.markAllAsTouched();
      return;
    }

    const formValue = this.createOrderForm.getRawValue();

    this.orderService
      .createAdminOrder({
        userId: formValue.userId,
        total: formValue.total,
        status: formValue.status,
        address: formValue.address,
        phone: formValue.phone
      })
      .subscribe({
        next: (createdOrder) => {
          this.createOrderVisible.set(false);
          this.upsertOrderInView(createdOrder);
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Commande ajoutee'
          });
        },
        error: (error: Error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: error.message
          });
        }
      });
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

  private toOrderView(order: Order): OrderView {
    return {
      ...order,
      userName: this.getUserName(order.userId)
    };
  }

  private upsertOrderInView(order: Order): void {
    const orderView = this.toOrderView(order);

    if (!this.matchesActiveFilters(orderView)) {
      this.removeOrderFromView(order.id);
      return;
    }

    const currentOrders = this.orders();
    const existingIndex = currentOrders.findIndex((item) => item.id === order.id);

    if (existingIndex >= 0) {
      const updated = [...currentOrders];
      updated[existingIndex] = orderView;
      this.orders.set(updated);
      return;
    }

    this.totalRecords.update((total) => total + 1);

    if (this.currentPage() !== 1) {
      return;
    }

    this.orders.set([orderView, ...currentOrders].slice(0, this.rows()));
  }

  private removeOrderFromView(orderId: number): void {
    const currentOrders = this.orders();
    const filtered = currentOrders.filter((item) => item.id !== orderId);

    if (filtered.length === currentOrders.length) {
      return;
    }

    this.orders.set(filtered);
    this.totalRecords.update((total) => Math.max(total - 1, 0));

    if (filtered.length === 0 && this.currentPage() > 1) {
      this.currentPage.update((page) => Math.max(page - 1, 1));
      this.loadOrders();
    }
  }

  private matchesActiveFilters(order: OrderView): boolean {
    if (this.statusFilter() !== 'all' && order.status !== this.statusFilter()) {
      return false;
    }

    if (this.dateFrom()) {
      const from = new Date(this.dateFrom());
      from.setHours(0, 0, 0, 0);
      if (new Date(order.createdAt).getTime() < from.getTime()) {
        return false;
      }
    }

    if (this.dateTo()) {
      const to = new Date(this.dateTo());
      to.setHours(23, 59, 59, 999);
      if (new Date(order.createdAt).getTime() > to.getTime()) {
        return false;
      }
    }

    const term = this.searchTerm().trim().toLowerCase();

    if (!term) {
      return true;
    }

    return [
      String(order.id),
      order.userName,
      order.address,
      order.phone,
      order.promoCode ?? ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  }
}
