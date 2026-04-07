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
import { Product } from '../../shared/models/product.model';

interface Review {
  id: number;
  userId: number;
  userName: string;
  userAvatar: string;
  rating: number;
  title: string;
  comment: string;
  date: Date;
  likes: number;
  verified: boolean;
  images?: string[];
}

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
  reviews: Review[] = [];
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
    this.productService.getProductById(productId).subscribe(product => {
      if (product) {
        this.product = product;
        this.loadRelatedProducts();
        this.loadReviews();
        this.calculateReviewStats();
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

  loadReviews() {
    // Mock reviews data
    this.reviews = [
      {
        id: 1,
        userId: 1,
        userName: 'Sophie Martin',
        userAvatar: 'https://randomuser.me/api/portraits/women/1.jpg',
        rating: 5,
        title: 'Magnifique bijou !',
        comment: 'Je suis absolument ravie de cet achat. La qualité est exceptionnelle et le design est exactement comme sur les photos. Livraison rapide et emballage soigné. Je recommande vivement !',
        date: new Date('2024-01-15'),
        likes: 24,
        verified: true,
        images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=200']
      },
      {
        id: 2,
        userId: 2,
        userName: 'Julie Bernard',
        userAvatar: 'https://randomuser.me/api/portraits/women/2.jpg',
        rating: 4,
        title: 'Très belle qualité',
        comment: 'Le collier est vraiment superbe. La chaîne est fine mais solide. Seul petit bémol, la boîte était légèrement abîmée. Mais le produit en lui-même est parfait.',
        date: new Date('2024-01-10'),
        likes: 12,
        verified: true
      },
      {
        id: 3,
        userId: 3,
        userName: 'Marie Lambert',
        userAvatar: 'https://randomuser.me/api/portraits/women/3.jpg',
        rating: 5,
        title: 'Coup de cœur !',
        comment: 'Un cadeau pour ma sœur qui a adoré. Les finitions sont impeccables et le rendu est encore plus beau en vrai. Merci pour ce magnifique produit.',
        date: new Date('2024-01-05'),
        likes: 18,
        verified: true,
        images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200']
      },
      {
        id: 4,
        userId: 4,
        userName: 'Emma Dubois',
        userAvatar: 'https://randomuser.me/api/portraits/women/4.jpg',
        rating: 5,
        title: 'Parfait pour une occasion spéciale',
        comment: 'Porté lors d\'un mariage, j\'ai reçu beaucoup de compliments. Le bijou est élégant sans être trop voyant. Le rapport qualité-prix est excellent.',
        date: new Date('2023-12-28'),
        likes: 31,
        verified: true
      },
      {
        id: 5,
        userId: 5,
        userName: 'Laura Petit',
        userAvatar: 'https://randomuser.me/api/portraits/women/5.jpg',
        rating: 4,
        title: 'Très satisfaite',
        comment: 'Livraison rapide, produit conforme à la description. La taille est parfaite. Je recommande ce vendeur.',
        date: new Date('2023-12-20'),
        likes: 7,
        verified: true
      }
    ];
  }

  calculateReviewStats() {
    this.reviewStats.total = this.reviews.length;
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

    this.isSubmittingReview = true;
    
    // Simulate API call
    setTimeout(() => {
      const newReviewObj: Review = {
        id: this.reviews.length + 1,
        userId: 999,
        userName: 'Vous',
        userAvatar: 'https://randomuser.me/api/portraits/women/default.jpg',
        rating: this.newReview.rating,
        title: this.newReview.title,
        comment: this.newReview.comment,
        date: new Date(),
        likes: 0,
        verified: false
      };
      
      this.reviews.unshift(newReviewObj);
      this.calculateReviewStats();
      
      this.messageService.add({
        severity: 'success',
        summary: 'Avis publié',
        detail: 'Merci pour votre avis !'
      });
      
      this.showReviewDialog = false;
      this.newReview = { rating: 5, title: '', comment: '' };
      this.isSubmittingReview = false;
    }, 1000);
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

  formatDate(date: Date): string {
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
    return (this.reviewStats.distribution[rating] / this.reviewStats.total) * 100;
  }

  roundRating(value: number): number {
    return Math.round(value);
  }
}