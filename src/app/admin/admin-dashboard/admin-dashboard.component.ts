import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { ProductService } from '../../core/services/product.service';
import type { Order } from '../../shared/models/order.model';
import type { Product } from '../../shared/models/product.model';

interface DashboardOrder extends Order {
  userName: string;
}

type DashboardStatKey = 'totalUsers' | 'totalOrders' | 'totalRevenue' | 'totalProducts';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [ChartModule, CommonModule, RouterLink, TableModule, TagModule],
  template: `
    <div class="admin-dashboard">
      <section class="dashboard-hero">
        <div>
          <p class="eyebrow">Pilotage e-commerce</p>
          <h1>Dashboard Exécutif</h1>
          <p class="hero-subtitle">Vue synthétique des performances commerciales et des opérations.</p>
        </div>
        <div class="hero-side">
          <p class="date-label">{{ now | date: 'EEEE d MMMM y' }}</p>
          <p-tag value="Temps réel" severity="success"></p-tag>
        </div>
      </section>

      <section class="stats-grid">
        <article class="stat-card users">
          <i class="pi pi-users stat-icon"></i>
          <p class="stat-label">Utilisateurs</p>
          <h3>{{ displayStats.totalUsers }}</h3>
          <span class="stat-foot">Base clients active</span>
        </article>

        <article class="stat-card orders">
          <i class="pi pi-shopping-bag stat-icon"></i>
          <p class="stat-label">Commandes</p>
          <h3>{{ displayStats.totalOrders }}</h3>
          <span class="stat-foot">{{ pendingOrdersCount }} en attente</span>
        </article>

        <article class="stat-card revenue">
          <i class="pi pi-chart-line stat-icon"></i>
          <p class="stat-label">Chiffre d'affaires</p>
          <h3>{{ formatCurrency(displayStats.totalRevenue) }}</h3>
          <span class="stat-foot">Panier moyen: {{ formatCurrency(averageOrderValue) }}</span>
        </article>

        <article class="stat-card inventory">
          <i class="pi pi-box stat-icon"></i>
          <p class="stat-label">Catalogue</p>
          <h3>{{ displayStats.totalProducts }}</h3>
          <span class="stat-foot">{{ lowStockProducts.length }} références à surveiller</span>
        </article>
      </section>

      <section class="insights-grid">
        <article class="insight-card">
          <p class="insight-label">Commandes livrées</p>
          <h4>{{ deliveredOrderRate }}%</h4>
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="deliveredOrderRate"></div>
          </div>
        </article>

        <article class="insight-card">
          <p class="insight-label">Produits en alerte stock</p>
          <h4>{{ lowStockRate }}%</h4>
          <div class="bar-track warning">
            <div class="bar-fill" [style.width.%]="lowStockRate"></div>
          </div>
        </article>
      </section>

      <section class="charts-grid">
        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h3>Ventes mensuelles</h3>
              <p class="panel-subtitle">Comparatif CA réalisé, objectif et volume de commandes.</p>
            </div>
            <div class="panel-legend" aria-hidden="true">
              <span class="legend-pill revenue">CA</span>
              <span class="legend-pill target">Objectif</span>
              <span class="legend-pill orders">Cmd</span>
            </div>
          </div>
          <div class="chart-container">
            <p-chart type="line" [data]="salesChartData" [options]="salesChartOptions"></p-chart>
          </div>
          <div class="chart-metrics">
            <p><span>CA annuel estimé</span><strong>{{ formatCurrency(annualRevenueForecast) }}</strong></p>
            <p><span>Taux d'atteinte objectif</span><strong>{{ objectiveAchievementRate }}%</strong></p>
            <p><span>Meilleur mois</span><strong>{{ bestSalesMonthLabel }} - {{ formatCurrency(bestSalesMonthRevenue) }}</strong></p>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <div>
              <h3>Répartition par catégorie</h3>
              <p class="panel-subtitle">Poids des catégories vs objectifs commerciaux.</p>
            </div>
            <div class="panel-legend" aria-hidden="true">
              <span class="legend-pill sales-share">Ventes</span>
              <span class="legend-pill target-share">Objectif</span>
            </div>
          </div>
          <div class="chart-container">
            <p-chart type="doughnut" [data]="categoryChartData" [options]="categoryChartOptions"></p-chart>
          </div>
          <div class="chart-metrics">
            <p><span>Catégorie leader</span><strong>{{ topCategoryLabel }}</strong></p>
            <p><span>Part de marché</span><strong>{{ topCategoryShare }}%</strong></p>
            <p><span>Objectif moyen</span><strong>{{ categoryTargetShare[0] }}% à {{ categoryTargetShare[categoryTargetShare.length - 1] }}%</strong></p>
          </div>
        </article>
      </section>

      <section class="tables-grid">
        <article class="panel-card">
          <div class="panel-head">
            <h3>Commandes récentes</h3>
            <button class="view-all" routerLink="/admin/orders">Voir tout</button>
          </div>
          <p-table [value]="recentOrders" [responsiveLayout]="'scroll'" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Total</th>
                <th>Statut</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-order>
              <tr>
                <td>#{{ order.id }}</td>
                <td>{{ order.userName }}</td>
                <td>{{ formatCurrency(order.total) }}</td>
                <td>
                  <p-tag [value]="getStatusLabel(order.status)" [severity]="getStatusSeverity(order.status)"></p-tag>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </article>

        <article class="panel-card">
          <div class="panel-head">
            <h3>Stock faible</h3>
            <button class="view-all" routerLink="/admin/products">Voir tout</button>
          </div>
          <p-table [value]="lowStockProducts" [responsiveLayout]="'scroll'" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Produit</th>
                <th>Stock</th>
                <th>Statut</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-product>
              <tr>
                <td>{{ product.name }}</td>
                <td>{{ product.stock }}</td>
                <td>
                  <p-tag
                    [value]="product.stock === 0 ? 'Rupture' : 'Stock faible'"
                    [severity]="product.stock === 0 ? 'danger' : 'warn'">
                  </p-tag>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </article>
      </section>
    </div>
  `,
  styleUrls: ['./admin-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);

  private readonly currencyFormatter = new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0
  });

  readonly stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0
  };

  readonly displayStats = {
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0
  };

  private readonly statAnimationFrames: Partial<Record<DashboardStatKey, number>> = {};

  readonly now = new Date();

  readonly monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  readonly monthlyRevenueData = [12500, 15000, 18000, 22000, 28000, 32000, 35000, 38000, 42000, 45000, 48000, 52000];
  readonly monthlyTargetData = [14000, 16000, 19000, 23000, 27000, 31000, 34000, 39000, 43000, 47000, 50000, 54000];
  readonly monthlyOrdersData = [220, 260, 280, 340, 390, 420, 455, 490, 530, 560, 590, 630];

  readonly categoryLabels = ['Colliers', 'Bagues', 'Bracelets', "Boucles d'oreilles"];
  readonly categorySalesShare = [35, 28, 22, 15];
  readonly categoryTargetShare = [32, 30, 23, 15];

  allOrders: Order[] = [];
  recentOrders: DashboardOrder[] = [];
  lowStockProducts: Product[] = [];

  salesChartData: unknown;
  salesChartOptions: unknown;
  categoryChartData: unknown;
  categoryChartOptions: unknown;

  readonly products = toSignal(this.productService.getProducts(), { initialValue: [] as Product[] });

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentOrders();
    this.loadLowStockProducts();
    this.initCharts();
  }

  ngOnDestroy(): void {
    if (typeof window === 'undefined') {
      return;
    }

    for (const frameId of Object.values(this.statAnimationFrames)) {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    }
  }

  loadStats(): void {
    this.productService.getProducts().subscribe((products) => {
      this.stats.totalProducts = products.length;
      this.animateStatValue('totalProducts', products.length, 850);
    });

    this.orderService.getAllOrders().subscribe((orders) => {
      this.allOrders = orders;
      this.stats.totalOrders = orders.length;
      this.stats.totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
      this.animateStatValue('totalOrders', this.stats.totalOrders, 900);
      this.animateStatValue('totalRevenue', this.stats.totalRevenue, 1000);
    });

    this.authService.getAllUsers().subscribe((users) => {
      this.stats.totalUsers = users.length;
      this.animateStatValue('totalUsers', users.length, 800);
    });
  }

  private animateStatValue(stat: DashboardStatKey, target: number, durationMs = 900): void {
    if (typeof window === 'undefined') {
      this.displayStats[stat] = Math.round(target);
      return;
    }

    const previousFrame = this.statAnimationFrames[stat];
    if (previousFrame) {
      window.cancelAnimationFrame(previousFrame);
    }

    const start = this.displayStats[stat] || 0;
    const delta = target - start;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - startTime) / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.displayStats[stat] = Math.round(start + delta * easedProgress);

      if (progress < 1) {
        this.statAnimationFrames[stat] = window.requestAnimationFrame(step);
      }
    };

    this.statAnimationFrames[stat] = window.requestAnimationFrame(step);
  }

  loadRecentOrders(): void {
    this.orderService.getRecentOrders(5).subscribe((orders) => {
      this.authService.getAllUsers().subscribe((users) => {
        const userMap = new Map(users.map((user) => [user.id, user.fullName] as const));

        this.recentOrders = orders.map((order) => ({
          ...order,
          userName: userMap.get(order.userId) || `Client #${order.userId}`
        }));
      });
    });
  }

  loadLowStockProducts(): void {
    this.productService.getLowStockProducts(10).subscribe((products) => {
      this.lowStockProducts = products;
    });
  }

  initCharts(): void {
    const primary = this.getCssVar('--primary-color', '#7a0e18');
    const primaryRgb = this.getCssVar('--primary-rgb', '122, 14, 24');
    const accent = this.getCssVar('--accent-color', '#d4af37');
    const accentRgb = this.getCssVar('--accent-rgb', '212, 175, 55');
    const textMain = this.getCssVar('--text-dark', '#2b1a1d');
    const textSoft = this.getCssVar('--text-gray', '#7a6a6e');
    const tooltipBg = this.getCssVar('--primary-dark', '#4d0810');

    this.salesChartData = {
      labels: this.monthLabels,
      datasets: [
        {
          type: 'line',
          label: 'CA réalisé (MAD)',
          data: this.monthlyRevenueData,
          fill: true,
          borderColor: primary,
          backgroundColor: this.rgbaFromRgb(primaryRgb, 0.14),
          pointBackgroundColor: primary,
          pointRadius: 3,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Objectif (MAD)',
          data: this.monthlyTargetData,
          fill: false,
          borderColor: this.rgbaFromRgb(primaryRgb, 0.45),
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.25,
          yAxisID: 'y'
        },
        {
          type: 'bar',
          label: 'Commandes',
          data: this.monthlyOrdersData,
          borderRadius: 6,
          backgroundColor: this.rgbaFromRgb(accentRgb, 0.24),
          borderColor: accent,
          yAxisID: 'y1'
        }
      ]
    };

    this.salesChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeOutCubic'
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'start',
          labels: {
            color: textMain,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 18,
            font: {
              size: 11,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: this.rgbaFromRgb(accentRgb, 0.35),
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context: { dataset: { yAxisID?: string; label?: string }; parsed: { y: number } }) => {
              if (context.dataset.yAxisID === 'y1') {
                return `${context.dataset.label || ''}: ${context.parsed.y}`;
              }

              return `${context.dataset.label || ''}: ${this.formatCurrency(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          position: 'left',
          beginAtZero: true,
          grid: {
            color: this.rgbaFromRgb(primaryRgb, 0.10)
          },
          ticks: {
            color: textSoft,
            callback: (value: string | number) => this.formatCompactCurrency(Number(value))
          }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: textSoft,
            precision: 0
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textSoft
          }
        }
      }
    };

    this.categoryChartData = {
      labels: this.categoryLabels,
      datasets: [
        {
          label: 'Part des ventes (%)',
          data: this.categorySalesShare,
          backgroundColor: [
            this.rgbaFromRgb(primaryRgb, 0.86),
            this.rgbaFromRgb(primaryRgb, 0.72),
            this.rgbaFromRgb(primaryRgb, 0.58),
            this.rgbaFromRgb(primaryRgb, 0.44)
          ],
          hoverBackgroundColor: [
            this.rgbaFromRgb(primaryRgb, 0.96),
            this.rgbaFromRgb(primaryRgb, 0.82),
            this.rgbaFromRgb(primaryRgb, 0.68),
            this.rgbaFromRgb(primaryRgb, 0.54)
          ]
        },
        {
          label: 'Objectif (%)',
          data: this.categoryTargetShare,
          backgroundColor: [
            this.rgbaFromRgb(accentRgb, 0.55),
            this.rgbaFromRgb(accentRgb, 0.42),
            this.rgbaFromRgb(accentRgb, 0.32),
            this.rgbaFromRgb(accentRgb, 0.24)
          ],
          hoverBackgroundColor: [
            this.rgbaFromRgb(accentRgb, 0.65),
            this.rgbaFromRgb(accentRgb, 0.52),
            this.rgbaFromRgb(accentRgb, 0.40),
            this.rgbaFromRgb(accentRgb, 0.30)
          ]
        }
      ]
    };

    this.categoryChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 950,
        easing: 'easeOutQuint'
      },
      cutout: '62%',
      radius: '95%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textMain,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 14,
            font: {
              size: 11,
              weight: '600'
            }
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: this.rgbaFromRgb(accentRgb, 0.35),
          borderWidth: 1,
          callbacks: {
            label: (context: { dataset: { label?: string }; label: string; parsed: number }) => {
              return `${context.dataset.label || ''} - ${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    };
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value || 0);
  }

  private formatCompactCurrency(value: number): string {
    const absolute = Math.abs(value);

    if (absolute >= 1000) {
      return `${Math.round(value / 1000)}k DH`;
    }

    return `${Math.round(value)} DH`;
  }

  get averageOrderValue(): number {
    return this.stats.totalOrders ? this.stats.totalRevenue / this.stats.totalOrders : 0;
  }

  get pendingOrdersCount(): number {
    return this.allOrders.filter((order) => order.status === 'pending').length;
  }

  get deliveredOrderRate(): number {
    if (!this.allOrders.length) {
      return 0;
    }

    const delivered = this.allOrders.filter((order) => order.status === 'delivered').length;
    return Math.round((delivered / this.allOrders.length) * 100);
  }

  get lowStockRate(): number {
    if (!this.stats.totalProducts) {
      return 0;
    }

    return Math.round((this.lowStockProducts.length / this.stats.totalProducts) * 100);
  }

  get annualRevenueForecast(): number {
    return this.monthlyRevenueData.reduce((sum, value) => sum + value, 0);
  }

  get annualTargetForecast(): number {
    return this.monthlyTargetData.reduce((sum, value) => sum + value, 0);
  }

  get objectiveAchievementRate(): number {
    const target = this.annualTargetForecast;
    if (!target) return 0;
    return Math.round((this.annualRevenueForecast / target) * 100);
  }

  get bestSalesMonthLabel(): string {
    const highestValue = Math.max(...this.monthlyRevenueData);
    const highestIndex = this.monthlyRevenueData.indexOf(highestValue);
    return this.monthLabels[highestIndex] || '-';
  }

  get bestSalesMonthRevenue(): number {
    return Math.max(...this.monthlyRevenueData);
  }

  get topCategoryLabel(): string {
    const highestValue = Math.max(...this.categorySalesShare);
    const highestIndex = this.categorySalesShare.indexOf(highestValue);
    return this.categoryLabels[highestIndex] || '-';
  }

  get topCategoryShare(): number {
    return Math.max(...this.categorySalesShare);
  }

  private getCssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;

    const value = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();

    return value || fallback;
  }

  private rgbaFromRgb(rgb: string, alpha: number): string {
    return `rgba(${rgb}, ${alpha})`;
  }

  getStatusSeverity(status: string): 'warn' | 'info' | 'success' | 'secondary' {
    const map: Record<string, 'warn' | 'info' | 'success' | 'secondary'> = {
      pending: 'warn',
      confirmed: 'info',
      delivered: 'success'
    };
    return map[status] || 'secondary';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      delivered: 'Livrée'
    };
    return map[status] || status;
  }
}
