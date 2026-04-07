import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  isScrolled: boolean = false;
  searchQuery: string = '';
  showSearchBar: boolean = false;

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
      if (user) {
        this.userMenu = [
          {
            label: user.fullName,
            icon: 'pi pi-user',
            items: [
              { label: 'Mon Profil', icon: 'pi pi-user', routerLink: '/profile' },
              { label: 'Mes Commandes', icon: 'pi pi-shopping-bag', routerLink: '/profile' },
              { label: "Liste d'envies", icon: 'pi pi-heart', routerLink: '/wishlist' },
              { separator: true },
              { label: 'Déconnexion', icon: 'pi pi-sign-out', command: () => this.logout() },
            ],
          },
        ];
      } else {
        this.userMenu = [
          { label: 'Connexion', icon: 'pi pi-sign-in', routerLink: '/auth/login' },
          { label: 'Inscription', icon: 'pi pi-user-plus', routerLink: '/auth/register' },
        ];
      }
    });
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
}
