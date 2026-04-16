// header.component.ts - Version améliorée
import { Component, HostListener, OnInit, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenubarModule } from 'primeng/menubar';
import { SplitButtonModule } from 'primeng/splitbutton';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    FormsModule,
    InputTextModule,
    MenubarModule,
    RouterLink,
    SplitButtonModule,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  items: MenuItem[] = [];
  cartCount: number = 0;
  wishlistCount: number = 0;
  ordersCount: number = 0;
  userMenu: MenuItem[] = [];
  currentUser: any = null;
  userMenuVisible = false;
  isScrolled: boolean = false;
  searchQuery: string = '';
  showSearchBar: boolean = false;
  showMobileMenu: boolean = false;
  mobileNavLeft: number = 12;
  private clickOutsideListener: (() => void) | null = null;

  @ViewChild('mobileBtn', { read: ElementRef }) mobileBtn?: ElementRef;
  @ViewChild('mobileNav', { read: ElementRef }) mobileNav?: ElementRef;

  constructor(
    private router: Router,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.initMenu();
    this.initUserMenu();
    this.subscribeToCart();
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    // Fermer le menu utilisateur si clic en dehors
    if (this.userMenuVisible) {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-dropdown')) {
        this.userMenuVisible = false;
      }
    }
    
    // Fermer le menu mobile si clic en dehors
    if (this.showMobileMenu) {
      const target = event.target as HTMLElement;
      const mobileNav = this.mobileNav?.nativeElement;
      const mobileBtn = this.mobileBtn?.nativeElement;
      
      if (mobileNav && mobileBtn) {
        if (!mobileNav.contains(target) && !mobileBtn.contains(target)) {
          this.closeMobileMenu();
        }
      }
    }
    
    // Fermer la search bar si clic en dehors
    if (this.showSearchBar) {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-bar') && !target.closest('.action-btn')) {
        this.showSearchBar = false;
      }
    }
  }

  @HostListener('window:resize')
  onResize() {
    // Fermer le menu mobile sur resize
    if (window.innerWidth > 768 && this.showMobileMenu) {
      this.closeMobileMenu();
    }
  }

  initMenu() {
    this.items = [
      {
        label: 'Accueil',
        icon: 'pi pi-home',
        routerLink: '/home',
        command: () => this.navigateAndClose('/home'),
      },
      {
        label: 'Produits',
        icon: 'pi pi-box',
        routerLink: '/products',
        command: () => this.navigateAndClose('/products'),
      },
      {
        label: 'Catégories',
        icon: 'pi pi-tags',
        styleClass: 'mega-parent',
        items: [
          {
            label: 'Colliers',
            icon: 'pi pi-gem',
            command: () => this.navigateAndClose('/products', { category: 'necklaces' }),
          },
          {
            label: 'Bagues',
            icon: 'pi pi-circle',
            command: () => this.navigateAndClose('/products', { category: 'rings' }),
          },
          {
            label: 'Bracelets',
            icon: 'pi pi-link',
            command: () => this.navigateAndClose('/products', { category: 'bracelets' }),
          },
        ],
      },
    ];
  }

  initUserMenu() {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        // update orders count for current user
        this.orderService.getUserOrders().subscribe((orders) => {
          this.ordersCount = orders?.length ?? 0;
        });
        this.userMenu = [
          { label: 'Mon Profil', icon: 'pi pi-user', routerLink: '/profile' },
          { label: 'Mes Commandes', icon: 'pi pi-shopping-bag', routerLink: '/profile' },
          { label: "Liste d'envies", icon: 'pi pi-heart', routerLink: '/wishlist' },
          { separator: true },
          { label: 'Déconnexion', icon: 'pi pi-sign-out', command: () => this.logout() },
        ];
      } else {
        this.userMenu = [
          { label: 'Connexion', icon: 'pi pi-sign-in', routerLink: '/auth/login' },
          { label: 'Inscription', icon: 'pi pi-user-plus', routerLink: '/auth/register' },
        ];
      }
    });
  }

  toggleUserMenu() {
    this.userMenuVisible = !this.userMenuVisible;
  }

  getInitials(fullName: string): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  handleUserMenuEntry(entry: MenuItem) {
    try {
      if (entry.command) {
        (entry.command as any)();
      } else if (entry.label === 'Mes Commandes') {
        // navigate to profile and open orders tab
        this.router.navigate(['/profile'], { queryParams: { tab: 'orders' } });
      } else if (entry.routerLink) {
        const rl: any = entry.routerLink;
        this.router.navigate(Array.isArray(rl) ? rl : [rl]);
      }
    } catch (e) {
      console.error('Error handling user menu entry:', e);
    } finally {
      this.userMenuVisible = false;
    }
  }

  subscribeToCart() {
    this.cartService.cartCount$.subscribe((count) => {
      this.cartCount = count;
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/home']);
    this.userMenuVisible = false;
  }

  search() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
      this.showSearchBar = false;
      this.searchQuery = '';
    }
  }

  goToCart() {
    this.router.navigate(['/cart']);
  }

  goToWishlist() {
    this.router.navigate(['/wishlist']);
  }

  toggleMobileMenu() {
    if (!this.showMobileMenu) {
      this.openMobileMenu();
    } else {
      this.closeMobileMenu();
    }
  }
  
  private openMobileMenu() {
    setTimeout(() => {
      try {
        const btn = this.mobileBtn?.nativeElement as HTMLElement;
        const menu = this.mobileNav?.nativeElement as HTMLElement;
        if (btn && menu) {
          const rect = btn.getBoundingClientRect();
          let left = Math.round(rect.left + window.scrollX - 6);
          const menuWidth = Math.min(menu.offsetWidth || 200, window.innerWidth - 24);
          const maxLeft = Math.max(8, window.innerWidth - menuWidth - 12);
          if (left > maxLeft) left = maxLeft;
          if (left < 8) left = 8;
          this.mobileNavLeft = left;
        }
      } catch (e) {
        console.error('Error positioning mobile menu:', e);
      }
    }, 0);
    
    this.showMobileMenu = true;
    this.disableBodyScroll();
  }
  
  closeMobileMenu() {
    this.showMobileMenu = false;
    this.enableBodyScroll();
  }
  
  private disableBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }
  
  private enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }

  navigateToItem(item: MenuItem) {
    this.navigateAndClose(item.routerLink as string, item.queryParams);
  }
  
  private navigateAndClose(routerLink: string, queryParams?: any) {
    try {
      if (queryParams) {
        this.router.navigate([routerLink], { queryParams });
      } else if (routerLink) {
        this.router.navigate([routerLink]);
      }
    } catch (e) {
      console.error('Navigation error:', e);
    } finally {
      this.closeMobileMenu();
    }
  }
}