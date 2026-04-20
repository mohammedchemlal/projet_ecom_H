import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { PromoCodeService } from '../../core/services/promo-code.service';
import { ProductService } from '../../core/services/product.service';
import type { User } from '../../shared/models/user.model';
import type { PromoCode } from '../../shared/models/promo-code.model';

interface AdminNavItem {
  label: string;
  icon: string;
  route: string;
  hint: string;
  badge?: number;
}

type BadgeTone = 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-admin-layout',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
  host: {
    '(document:keydown.escape)': 'handleEscapeKey()',
    '(document:touchstart)': 'handleTouchStart($event)',
    '(document:touchend)': 'handleTouchEnd($event)'
  }
})
export class AdminLayoutComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderService = inject(OrderService);
  private readonly promoCodeService = inject(PromoCodeService);
  private readonly productService = inject(ProductService);

  readonly siteLogoSrc = '/favicon.ico';
  logoLoadFailed = false;
  headerLogoLoadFailed = false;

  sidebarVisible = true;
  navItems: AdminNavItem[] = [];
  currentUserLabel = 'Utilisateur';
  readonly currentUser = signal<User | null>(null);
  readonly profilePanelVisible = signal(false);
  readonly currentUserInitials = computed(() => this.getUserInitials(this.currentUser()));
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.navItems = [
      { label: 'Dashboard', icon: 'pi pi-chart-line', route: '/admin/dashboard', hint: 'Vue globale' },
      { label: 'Produits', icon: 'pi pi-box', route: '/admin/products', hint: 'Catalogue' },
      { label: 'Commandes', icon: 'pi pi-shopping-cart', route: '/admin/orders', hint: 'Suivi ventes' },
      { label: 'Utilisateurs', icon: 'pi pi-users', route: '/admin/users', hint: 'Comptes clients' },
      { label: 'Catégories', icon: 'pi pi-tags', route: '/admin/categories', hint: 'Organisation' },
      { label: 'Codes promo', icon: 'pi pi-ticket', route: '/admin/promo-codes', hint: 'Marketing' },
      { label: 'Témoignages', icon: 'pi pi-comment', route: '/admin/testimonials', hint: 'Preuve sociale' }
    ];

    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        // Schedule updates in a microtask to avoid ExpressionChangedAfterItHasBeenCheckedError
        Promise.resolve().then(() => {
          this.currentUser.set(user);
          this.currentUserLabel = user?.fullName?.trim() || user?.email?.trim() || 'Utilisateur';
        });
      });

    this.bindMenuBadges();
  }

  private bindMenuBadges(): void {
    this.orderService
      .getAllOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orders) => {
        const pendingOrdersCount = orders.filter((order) => order.status === 'pending').length;
        this.updateBadge('/admin/orders', pendingOrdersCount);
      });

    this.productService
      .getLowStockProducts(10)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.updateBadge('/admin/products', products.length);
      });

    this.promoCodeService
      .getPromoCodes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((promoCodes) => {
        const expiredCount = promoCodes.filter((promoCode) => this.isPromoExpired(promoCode)).length;
        this.updateBadge('/admin/promo-codes', expiredCount);
      });
  }

  private isPromoExpired(promoCode: PromoCode): boolean {
    return new Date(promoCode.validTo).getTime() < Date.now();
  }

  private updateBadge(route: string, count: number): void {
    // Update navItems in next microtask to avoid changing bound values during CD
    Promise.resolve().then(() => {
      this.navItems = this.navItems.map((item) =>
        item.route === route
          ? {
              ...item,
              badge: count
            }
          : item
      );
    });
  }

  getBadgeLabel(count?: number): string {
    if (!count) {
      return '';
    }

    return count > 99 ? '99+' : String(count);
  }

  getBadgeTone(route: string): BadgeTone {
    if (route === '/admin/orders') {
      return 'warning';
    }

    if (route === '/admin/promo-codes') {
      return 'danger';
    }

    if (route === '/admin/products') {
      return 'info';
    }

    return 'neutral';
  }

  isWarningBadge(route: string): boolean {
    return this.getBadgeTone(route) === 'warning';
  }

  isDangerBadge(route: string): boolean {
    return this.getBadgeTone(route) === 'danger';
  }

  isInfoBadge(route: string): boolean {
    return this.getBadgeTone(route) === 'info';
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  toggleProfilePanel(): void {
    this.profilePanelVisible.update((visible) => !visible);
  }

  closeProfilePanel(): void {
    this.profilePanelVisible.set(false);
  }

  closeSidebar(): void {
    this.sidebarVisible = false;
  }

  handleEscapeKey(): void {
    if (this.sidebarVisible) {
      this.closeSidebar();
    }
  }

  handleTouchStart(event: TouchEvent): void {
    if (!this.sidebarVisible || !this.isMobileViewport()) {
      return;
    }

    const touch = event.changedTouches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  handleTouchEnd(event: TouchEvent): void {
    if (!this.sidebarVisible || !this.isMobileViewport() || this.touchStartX === null || this.touchStartY === null) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    this.touchStartX = null;
    this.touchStartY = null;

    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isSwipeLeft = deltaX < -60;

    if (isHorizontalSwipe && isSwipeLeft) {
      this.closeSidebar();
    }
  }

  onNavigationClick(): void {
    this.closeProfilePanel();

    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  openBadgeRoute(event: Event, route: string): void {
    const queryParams = this.getBadgeQueryParams(route);

    if (!queryParams) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.router.navigate([route], { queryParams });

    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  private getBadgeQueryParams(route: string): Params | null {
    if (route === '/admin/orders') {
      return { status: 'pending' };
    }

    if (route === '/admin/products') {
      return { stock: 'low' };
    }

    if (route === '/admin/promo-codes') {
      return { state: 'expired' };
    }

    return null;
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  logout() {
    this.closeProfilePanel();
    this.authService.logout();
    this.router.navigate(['/home']);
  }

  private getUserInitials(user: User | null): string {
    if (!user) {
      return 'U';
    }

    const parts = user.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return user.email?.trim().charAt(0).toUpperCase() || 'U';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
}
