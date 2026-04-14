import { Component, HostListener, OnInit, ElementRef, ViewChild } from '@angular/core';
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
  logoLoadFailed: boolean = false;

  items: MenuItem[] = [];
  cartCount: number = 0;
  wishlistCount: number = 0;
  userMenu: MenuItem[] = [];
  currentUser: any = null;
  userMenuVisible = false;
  isScrolled: boolean = false;
  searchQuery: string = '';
  showSearchBar: boolean = false;
  showMobileMenu: boolean = false;
  mobileNavLeft: number = 12;

  @ViewChild('mobileBtn', { read: ElementRef }) mobileBtn?: ElementRef;
  @ViewChild('mobileNav', { read: ElementRef }) mobileNav?: ElementRef;

  constructor(
    private router: Router,
    private cartService: CartService,
    private authService: AuthService,
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

  initMenu() {
    this.items = [
      {
        label: 'Accueil',
        icon: 'pi pi-home',
        routerLink: '/home',
        command: () => this.router.navigate(['/home']),
      },
      {
        label: 'Produits',
        icon: 'pi pi-box',
        routerLink: '/products',
        command: () => this.router.navigate(['/products']),
      },
      {
        label: 'Catégories',
        icon: 'pi pi-tags',
        styleClass: 'mega-parent',
        items: [
          {
            label: 'Colliers',
            icon: 'pi pi-gem',
            command: () =>
              this.router.navigate(['/products'], { queryParams: { category: 'necklaces' } }),
          },
          {
            label: 'Bagues',
            icon: 'pi pi-circle',
            command: () =>
              this.router.navigate(['/products'], { queryParams: { category: 'rings' } }),
          },
          {
            label: 'Bracelets',
            icon: 'pi pi-link',
            command: () =>
              this.router.navigate(['/products'], { queryParams: { category: 'bracelets' } }),
          },
        ],
      },
    ];
  }

  initUserMenu() {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
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
      } else if (entry.routerLink) {
        const rl: any = entry.routerLink;
        this.router.navigate(Array.isArray(rl) ? rl : [rl]);
      }
    } catch (e) {
      // ignore
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
    // when opening, compute left position of the hamburger to anchor the floating menu
    if (!this.showMobileMenu) {
      setTimeout(() => {
        try {
          const btn = this.mobileBtn?.nativeElement as HTMLElement;
          const menu = this.mobileNav?.nativeElement as HTMLElement;
          if (btn && menu) {
            const rect = btn.getBoundingClientRect();
            // initial left anchored to the button
            let left = Math.round(rect.left + window.scrollX - 6);
            // ensure the menu fits in the viewport: if overflow to right, shift left
            const menuWidth = Math.min(menu.offsetWidth || 200, window.innerWidth - 24);
            const maxLeft = Math.max(8, window.innerWidth - menuWidth - 12);
            if (left > maxLeft) left = maxLeft;
            if (left < 8) left = 8;
            this.mobileNavLeft = left;
          }
        } catch (e) {
          // ignore measurement errors
        }
      }, 0);
    }

    this.showMobileMenu = !this.showMobileMenu;
  }

  navigateToItem(item: MenuItem) {
    try {
      if (item.command) {
        // MenuItem.command might expect an event; call safely
        (item.command as any)();
      } else if (item.routerLink) {
        const rl: any = item.routerLink;
        this.router.navigate(Array.isArray(rl) ? rl : [rl]);
      }
    } catch (e) {
      // fallback: close mobile menu and ignore
    } finally {
      this.showMobileMenu = false;
    }
  }
}
