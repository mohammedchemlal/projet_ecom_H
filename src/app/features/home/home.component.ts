import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarouselModule } from 'primeng/carousel';
import { RatingModule } from 'primeng/rating';

import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { Product } from '../../shared/models/product.model';

@Component({
  selector: 'app-home',
  imports: [CarouselModule, CommonModule, CurrencyPipe, FormsModule, RatingModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  featuredProducts: Product[] = [];
  newArrivals: Product[] = [];
  isLoading = true;

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
      image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1600&q=80',
      title: 'Collection Automne/Hiver 2026',
      subtitle: 'Découvrez notre nouvelle collection de bijoux raffinés',
      cta: 'Explorer'
    },
    {
      image: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1600&q=80',
      title: 'Élégance Intemporelle',
      subtitle: 'Des pièces uniques pour chaque occasion',
      cta: 'Découvrir'
    },
    {
      image: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=1600&q=80',
      title: 'Offre Spéciale -30%',
      subtitle: 'Sur une sélection premium • Stock limité',
      cta: 'Profiter'
    }
  ];

  categories = [
    {
      name: 'Colliers',
      image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=80',
      link: '/products?category=necklaces',
      count: 45
    },
    {
      name: 'Bagues',
      image: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=900&q=80',
      link: '/products?category=rings',
      count: 32
    },
    {
      name: 'Bracelets',
      image: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=900&q=80',
      link: '/products?category=bracelets',
      count: 28
    }
  ];

  testimonials = [
    {
      name: 'Sophie Martin',
      role: 'Cliente fidèle',
      comment: 'Des bijoux d\'une qualité exceptionnelle. Le service client est remarquable et les livraisons sont rapides.',
      rating: 5,
      image: 'https://randomuser.me/api/portraits/women/1.jpg'
    },
    {
      name: 'Julie Bernard',
      role: 'Collectionneuse',
      comment: 'J\'adore la finesse des créations. Chaque pièce est unique et parfaitement finie.',
      rating: 5,
      image: 'https://randomuser.me/api/portraits/women/2.jpg'
    },
    {
      name: 'Marie Lambert',
      role: 'Influenceuse mode',
      comment: 'Mes clients adorent ces bijoux. Le rapport qualité-prix est imbattable.',
      rating: 5,
      image: 'https://randomuser.me/api/portraits/women/3.jpg'
    }
  ];

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly wishlistService: WishlistService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;

    this.productService.getFeaturedProducts().subscribe((products) => {
      this.featuredProducts = products.slice(0, 4);
      this.newArrivals = products.slice(4, 8);
      this.isLoading = false;
    });
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

  private isValidEmail(value: string): boolean {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }
}
