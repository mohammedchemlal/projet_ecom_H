import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { RatingModule } from 'primeng/rating';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { Product, ProductReview } from '../../shared/models/product.model';

interface ReviewStats {
  average: number;
  total: number;
  distribution: { [key: number]: number };
}

@Component({
  selector: 'app-product-detail',
  imports: [CommonModule, FormsModule, RouterLink, RatingModule, DialogModule, InputTextModule, TextareaModule, ButtonModule],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: Product | null = null;
  relatedProducts: Product[] = [];
  isLoading = true;
  quantity = 1;
  selectedImageIndex = 0;
  activeTab: 'description' | 'reviews' = 'description';
  
  // Review related
  reviews: ProductReview[] = [];
  reviewStats: ReviewStats = { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  newReview = {
    rating: 5,
    title: '',
    comment: ''
  };
  showReviewDialog = false;
  isSubmittingReview = false;
  
  // Zoom modal
  showZoomModal = false;
  zoomImageIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const productId = +params['id'];
      if (productId) {
        this.loadProduct(productId);
      }
    });
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  loadProduct(productId: number) {
    this.isLoading = true;
    this.loadReviews(productId);

    this.productService.getProductById(productId).subscribe(product => {
      if (product) {
        this.product = product;
        this.loadRelatedProducts();
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Produit non trouvé'
        });
        this.router.navigate(['/products']);
      }
      this.isLoading = false;
    });
  }

  loadRelatedProducts() {
    if (this.product) {
      this.productService.getProductsByCategory(this.product.category).subscribe(products => {
        this.relatedProducts = products.filter(p => p.id !== this.product?.id).slice(0, 4);
      });
    }
  }

  loadReviews(productId: number) {
    this.productService.getProductReviews(productId).subscribe((reviews) => {
      this.reviews = reviews;
      this.calculateReviewStats();
    });
  }

  calculateReviewStats() {
    this.reviewStats.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.reviewStats.total = this.reviews.length;

    if (this.reviewStats.total === 0) {
      this.reviewStats.average = 0;
      return;
    }

    let sum = 0;
    
    this.reviews.forEach(review => {
      sum += review.rating;
      this.reviewStats.distribution[review.rating]++;
    });
    
    this.reviewStats.average = sum / this.reviews.length;
  }

  addToCart() {
    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity);
      this.messageService.add({
        severity: 'success',
        summary: 'Ajouté au panier',
        detail: `${this.quantity} × ${this.product.name} a été ajouté à votre panier`,
        life: 3000
      });
    }
  }

  addToWishlist() {
    if (this.product) {
      this.wishlistService.addToWishlist(this.product);
      const isInWishlist = this.wishlistService.isInWishlist(this.product.id);
      this.messageService.add({
        severity: isInWishlist ? 'success' : 'info',
        summary: isInWishlist ? 'Ajouté aux favoris' : 'Retiré des favoris',
        detail: isInWishlist ? `${this.product.name} a été ajouté à vos favoris` : `${this.product.name} a été retiré de vos favoris`,
        life: 3000
      });
    }
  }

  submitReview() {
    if (!this.newReview.title.trim() || !this.newReview.comment.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Champs manquants',
        detail: 'Veuillez remplir tous les champs'
      });
      return;
    }

    if (this.newReview.title.trim().length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Titre trop court',
        detail: 'Le titre doit contenir au moins 2 caractères'
      });
      return;
    }

    if (this.newReview.comment.trim().length < 3) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Commentaire trop court',
        detail: 'Le commentaire doit contenir au moins 3 caractères'
      });
      return;
    }

    this.isSubmittingReview = true;

    if (!this.product) {
      this.isSubmittingReview = false;
      return;
    }

    this.productService
      .submitProductReview(this.product.id, {
        rating: this.newReview.rating,
        title: this.newReview.title,
        comment: this.newReview.comment
      })
      .subscribe({
        next: (review) => {
          this.reviews.unshift(review);
          this.calculateReviewStats();

          if (this.product) {
            this.product = {
              ...this.product,
              rating: this.reviewStats.average,
              reviewCount: this.reviewStats.total
            };
          }

          this.messageService.add({
            severity: 'success',
            summary: 'Avis publié',
            detail: 'Merci pour votre avis !'
          });

          this.showReviewDialog = false;
          this.newReview = { rating: 5, title: '', comment: '' };
          this.isSubmittingReview = false;
        },
        error: (error: Error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: error.message || 'Impossible de publier votre avis'
          });
          this.isSubmittingReview = false;
        }
      });
  }

  increaseQuantity() {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    }
  }

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  isInWishlist(): boolean {
    return this.product ? this.wishlistService.isInWishlist(this.product.id) : false;
  }

  getDiscountedPrice(): number {
    return this.product ? (this.product.discountPrice || this.product.price) : 0;
  }

  getDiscountPercentage(): number {
    if (!this.product?.discountPrice) return 0;
    return Math.round(((this.product.price - this.product.discountPrice) / this.product.price) * 100);
  }

  getStockStatus(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'En stock';
    if (this.product.stock > 0) return `Plus que ${this.product.stock} en stock`;
    return 'Rupture de stock';
  }

  getStockStatusClass(): string {
    if (!this.product) return '';
    if (this.product.stock > 10) return 'in-stock';
    if (this.product.stock > 0) return 'low-stock';
    return 'out-of-stock';
  }

  goBack() {
    this.location.back();
  }

  openZoomModal(index: number) {
    this.zoomImageIndex = index;
    this.showZoomModal = true;
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('fr-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  getStarsArray(rating: number): number[] {
    const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.floor(rating))) : 0;
    return Array(safeRating).fill(0);
  }

  getEmptyStarsArray(rating: number): number[] {
    const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.floor(rating))) : 0;
    return Array(5 - safeRating).fill(0);
  }

  getPercentageForRating(rating: number): number {
    if (this.reviewStats.total === 0) {
      return 0;
    }

    return (this.reviewStats.distribution[rating] / this.reviewStats.total) * 100;
  }

  roundRating(value: number): number {
    return Math.round(value);
  }

  getDetailedDescriptionParagraphs(): string[] {
    if (!this.product) {
      return [];
    }

    const source = this.product.detailedDescription?.trim() || this.product.description?.trim() || '';

    if (!source) {
      return [];
    }

    return source
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  getSpecificationSections(): { title: string; items: string[] }[] {
    if (!this.product?.specifications?.length) {
      return [];
    }

    return this.product.specifications
      .filter((section) => section.title.trim().length > 0 && section.items.length > 0)
      .map((section) => ({
        title: section.title,
        items: section.items.filter((item) => item.trim().length > 0)
      }))
      .filter((section) => section.items.length > 0);
  }
}