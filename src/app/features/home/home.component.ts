import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarouselModule } from 'primeng/carousel';
import { RatingModule } from 'primeng/rating';
import { finalize } from 'rxjs';

import { CategoryService, CategoryOption } from '../../core/services/category.service';
import { CartService } from '../../core/services/cart.service';
import { PromoCodeService } from '../../core/services/promo-code.service';
import { ProductService } from '../../core/services/product.service';
import { TestimonialService } from '../../core/services/testimonial.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { Product, Testimonial } from '../../shared/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

interface HomeCategoryCard {
  name: string;
  image: string;
  value: string;
  count: number;
}

@Component({
  selector: 'app-home',
  imports: [CarouselModule, CommonModule, CurrencyPipe, FormsModule, RatingModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  heroScrollProgress = 0; // 0..1 where 1 means hero fully scrolled past
  private cachedCategories: CategoryOption[] = [];
  private activeProducts: Product[] = [];

  featuredProducts: Product[] = [];
  newArrivals: Product[] = [];
  categories: HomeCategoryCard[] = [];
  heroReady = false;
  productsLoading = true;
  testimonialsLoading = true;
  promoBannerTitle = "Jusqu'a -30%";
  promoBannerSubtitle = 'Sur une selection de bijoux';
  promoBannerCta = "Profiter de l'offre";

  newsletterEmail = '';
  newsletterState: 'idle' | 'saving' | 'success' | 'error' = 'idle';
  newsletterMessage = '';

  readonly categoryResponsiveOptions = [
    {
      breakpoint: '1200px',
      numVisible: 3,
      numScroll: 1
    },
    {
      breakpoint: '992px',
      numVisible: 2,
      numScroll: 1
    },
    {
      breakpoint: '640px',
      numVisible: 1,
      numScroll: 1
    }
  ];

  heroSlides = [
    {
      // Existing assets found in public/assets/hero/
      image: 'assets/hero/hero.jpeg',
      alt: 'Modèle portant un collier élégant en studio',
      priority: true,
      title: 'Nouvelles Arrivées 2026',
      subtitle: "Élégance et savoir-faire — pièces sélectionnées avec soin",
      cta: 'Découvrir la collection'
    },
    {
      // Fallback: reuse first hero if a third image is not yet available
      image: 'assets/hero/hero.jpeg',
      alt: 'Ambiance studio avec bijoux et textures raffinées',
      priority: false,
      title: 'Offres Exclusives',
      subtitle: 'Profitez des remises saisonnières sur une sélection premium',
      cta: 'Profiter maintenant'
    }
  ];

  testimonials: Testimonial[] = [];

  constructor(
    private readonly categoryService: CategoryService,
    private readonly productService: ProductService,
    private readonly promoCodeService: PromoCodeService,
    private readonly testimonialService: TestimonialService,
    private readonly cartService: CartService,
    private readonly wishlistService: WishlistService
    ,
    public readonly authService: AuthService,
    public readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategoriesAndPromo();
    this.loadTestimonials();
    // Fallback: if hero images never fire load/error, show hero after short timeout
    setTimeout(() => {
      if (!this.heroReady) {
        this.heroReady = true;
        this.cdr.markForCheck();
      }
    }, 1500);
  }

  // Expose current user observable for template
  get currentUser$(): Observable<any> {
    return this.authService.currentUser$;
  }

  goToProfile(tab: string) {
    this.router.navigate(['/profile'], { queryParams: { tab } });
  }

  loadProducts(): void {
    this.productsLoading = true;

    this.productService
      .getProducts()
      .pipe(finalize(() => (this.productsLoading = false)))
      .subscribe({
      next: (products) => {
        this.activeProducts = products.filter((product) => product.isActive);
        const promotedProducts = this.activeProducts.filter((product) => product.isPromotion);

        this.featuredProducts = (promotedProducts.length > 0 ? promotedProducts : this.activeProducts).slice(0, 4);

        this.newArrivals = [...this.activeProducts]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 4);

        this.rebuildCategoryCards();
      },
      error: () => {
        this.featuredProducts = [];
        this.newArrivals = [];
      }
    });
  }

  loadCategoriesAndPromo(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.cachedCategories = categories;
        this.rebuildCategoryCards();
      }
    });

    this.promoCodeService.getPromoCodes().subscribe({
      next: (promoCodes) => {
        const bestPromo = promoCodes
          .filter((code) => code.isActive)
          .sort((a, b) => b.discount - a.discount)[0];

        if (bestPromo) {
          this.promoBannerTitle = `Code ${bestPromo.code} - ${bestPromo.discount}${bestPromo.type === 'percentage' ? '%' : ' MAD'}`;
          this.promoBannerSubtitle =
            bestPromo.type === 'percentage'
              ? 'Reduction immediate appliquee sur votre panier'
              : 'Montant de reduction fixe applique au paiement';
          this.promoBannerCta = 'Voir les promotions';
        }
      }
    });
  }

  loadTestimonials(): void {
    this.testimonialService
      .getTestimonials()
      .pipe(finalize(() => (this.testimonialsLoading = false)))
      .subscribe({
      next: (testimonials) => {
        this.testimonials = testimonials.slice(0, 6);
      },
      error: () => {
        this.testimonials = [];
      }
    });
  }

  onHeroImageLoad(isPrioritySlide: boolean): void {
    if (isPrioritySlide) {
      this.heroReady = true;
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const el = document.querySelector('.hero-carousel') as HTMLElement | null;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const height = rect.height || window.innerHeight;
    // progress = amount of hero scrolled off the viewport (0...1)
    const progress = Math.min(Math.max(-rect.top / height, 0), 1);
    this.heroScrollProgress = progress;
    this.cdr.markForCheck();
  }

  private rebuildCategoryCards(): void {
    if (this.cachedCategories.length === 0) {
      return;
    }

    this.categories = this.buildCategoryCards(this.cachedCategories, this.activeProducts);
  }

  private buildCategoryCards(categories: CategoryOption[], products: Product[]): HomeCategoryCard[] {
    const imageByCategory: Record<string, string> = {
      necklaces: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=80',
      rings: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80',
      bracelets: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80',
      earrings: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=900&q=80'
    };

    return categories.map((category) => ({
      name: category.label,
      image: imageByCategory[category.value] ?? imageByCategory['necklaces'],
      value: category.value,
      count: products.filter((product) => product.category === category.value).length
    }));
  }

  addToCart(product: Product): void {
    this.cartService.addToCart(product, 1);
  }

  addToWishlist(product: Product): void {
    this.wishlistService.addToWishlist(product);
  }

  getDiscountedPrice(product: Product): number {
    return product.discountPrice || product.price;
  }

  subscribeNewsletter(): void {
    const email = this.newsletterEmail.trim();

    if (!this.isValidEmail(email)) {
      this.newsletterState = 'error';
      this.newsletterMessage = "Veuillez saisir une adresse email valide.";
      return;
    }

    this.newsletterState = 'saving';
    this.newsletterMessage = '';

    setTimeout(() => {
      this.newsletterState = 'success';

      if (typeof window === 'undefined') {
        this.newsletterMessage = 'Merci ! Votre inscription est enregistrée.';
        this.newsletterEmail = '';
        return;
      }

      try {
        const normalizedEmail = email.toLowerCase();
        const storageKey = 'newsletter_subscribers';
        const raw = window.localStorage.getItem(storageKey);
        const existing = raw ? (JSON.parse(raw) as unknown) : [];
        const list = Array.isArray(existing) ? (existing as string[]) : [];

        if (list.includes(normalizedEmail)) {
          this.newsletterMessage = 'Vous êtes déjà inscrit à la newsletter.';
        } else {
          window.localStorage.setItem(storageKey, JSON.stringify([...list, normalizedEmail]));
          this.newsletterMessage = 'Merci ! Vous êtes inscrit à la newsletter.';
        }
      } catch {
        this.newsletterMessage = 'Merci ! Vous êtes inscrit à la newsletter.';
      }

      this.newsletterEmail = '';
    }, 400);
  }

  trackById(index: number, item: any): any {
    return item?.id ?? index;
  }

  normalizeImage(path?: string): string {
    if (!path) return 'https://via.placeholder.com/600x400?text=Image';
    // If image path looks like a server-side storage path, point to backend dev server
    if (path.startsWith('/storage') || path.startsWith('storage') || path.startsWith('/uploads')) {
      return `http://localhost:8000${path.startsWith('/') ? '' : '/'}${path}`.replace('//', '/').replace('http:/', 'http://');
    }
    return path;
  }

  /**
   * Return a WebP srcset string for the given image path.
   * Expects source images named like `/assets/hero/hero.jpeg` and generated files
   * `/assets/hero/hero@1920.webp`, `/assets/hero/hero@1280.webp`, `/assets/hero/hero@768.webp`.
   */
  getWebpSrcSet(imagePath: string): string {
    if (!imagePath) return '';
    const base = imagePath.replace(/\.[^.]+$/, '');
    return `${base}@1920.webp 1920w, ${base}@1280.webp 1280w, ${base}@768.webp 768w`;
  }

  private isValidEmail(value: string): boolean {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }
}
