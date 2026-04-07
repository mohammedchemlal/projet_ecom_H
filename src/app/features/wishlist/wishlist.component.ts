import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { RatingModule } from 'primeng/rating';
import { WishlistService } from '../../core/services/wishlist.service';
import { CartService } from '../../core/services/cart.service';
import { Product } from '../../shared/models/product.model';

@Component({
  selector: 'app-wishlist',
  imports: [CommonModule, CurrencyPipe, DialogModule, FormsModule, RatingModule, RouterLink],
  templateUrl: './wishlist.component.html',
  styleUrls: ['./wishlist.component.scss']
})
export class WishlistComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  wishlistItems: Product[] = [];
  isLoading = true;
  recommendedProducts: Product[] = [];
  
  // Share wishlist
  shareModalVisible = false;
  shareLink = '';
  
  // Move all to cart
  isMovingAllToCart = false;

  constructor(
    private wishlistService: WishlistService,
    private cartService: CartService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadWishlist();
    this.loadRecommendedProducts();
    this.generateShareLink();
  }

  ngOnDestroy() {
    // Cleanup
  }

  loadWishlist() {
    this.isLoading = true;
    this.wishlistService.wishlist$.subscribe(items => {
      this.wishlistItems = items;
      this.isLoading = false;
    });
  }

  loadRecommendedProducts() {
    // Mock recommended products based on wishlist items
    this.recommendedProducts = [
      {
        id: 101,
        name: 'Collier Élégance Dorée',
        description: '',
        price: 89.99,
        discountPrice: 67.49,
        images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300'],
        category: 'necklaces',
        rating: 4.8,
        reviewCount: 124,
        stock: 15,
        isActive: true,
        isPromotion: true,
        promotionPercentage: 25,
        createdAt: new Date()
      },
      {
        id: 102,
        name: 'Bague Solitaire Argent',
        description: '',
        price: 149.99,
        images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300'],
        category: 'rings',
        rating: 4.9,
        reviewCount: 89,
        stock: 23,
        isActive: true,
        isPromotion: false,
        createdAt: new Date()
      },
      {
        id: 103,
        name: 'Bracelet Chaîne Or Rose',
        description: '',
        price: 89.99,
        discountPrice: 71.99,
        images: ['https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=300'],
        category: 'bracelets',
        rating: 4.7,
        reviewCount: 56,
        stock: 30,
        isActive: true,
        isPromotion: true,
        promotionPercentage: 20,
        createdAt: new Date()
      },
      {
        id: 104,
        name: 'Boucles d\'Oreilles Perles',
        description: '',
        price: 79.99,
        images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300'],
        category: 'earrings',
        rating: 4.6,
        reviewCount: 78,
        stock: 45,
        isActive: true,
        isPromotion: false,
        createdAt: new Date()
      }
    ];
  }

  removeFromWishlist(product: Product) {
    this.wishlistService.removeFromWishlist(product.id);
    this.messageService.add({
      severity: 'success',
      summary: 'Produit retiré',
      detail: `${product.name} a été retiré de vos favoris`,
      life: 3000
    });
  }

  addToCart(product: Product) {
    if (product.stock === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Rupture de stock',
        detail: `${product.name} n'est plus disponible`,
        life: 3000
      });
      return;
    }
    
    this.cartService.addToCart(product, 1);
    this.messageService.add({
      severity: 'success',
      summary: 'Ajouté au panier',
      detail: `${product.name} a été ajouté à votre panier`,
      life: 3000
    });
  }

  addAllToCart() {
    if (this.wishlistItems.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Liste vide',
        detail: 'Ajoutez des produits à vos favoris d\'abord'
      });
      return;
    }

    this.isMovingAllToCart = true;
    
    // Simulate API call
    setTimeout(() => {
      this.wishlistItems.forEach(product => {
        if (product.stock > 0) {
          this.cartService.addToCart(product, 1);
        }
      });
      
      this.messageService.add({
        severity: 'success',
        summary: 'Ajout terminé',
        detail: `${this.wishlistItems.length} produits ont été ajoutés à votre panier`,
        life: 4000
      });
      
      this.isMovingAllToCart = false;
    }, 1000);
  }

  moveToCart(product: Product) {
    this.addToCart(product);
    this.removeFromWishlist(product);
  }

  viewProduct(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  getDiscountedPrice(product: Product): number {
    return product.discountPrice || product.price;
  }

  getDiscountPercentage(product: Product): number {
    if (!product.discountPrice) return 0;
    return Math.round(((product.price - product.discountPrice) / product.price) * 100);
  }

  getStockStatus(product: Product): string {
    if (product.stock > 10) return 'En stock';
    if (product.stock > 0) return `Plus que ${product.stock}`;
    return 'Rupture de stock';
  }

  getStockStatusClass(product: Product): string {
    if (product.stock > 10) return 'in-stock';
    if (product.stock > 0) return 'low-stock';
    return 'out-of-stock';
  }

  isEmpty(): boolean {
    return this.wishlistItems.length === 0;
  }

  getTotalItems(): number {
    return this.wishlistItems.length;
  }

  getTotalValue(): number {
    return this.wishlistItems.reduce((total, product) => {
      return total + (product.discountPrice || product.price);
    }, 0);
  }

  generateShareLink() {
    if (!this.isBrowser) {
      this.shareLink = '';
      return;
    }

    this.shareLink = `${window.location.origin}/wishlist/share/${Date.now()}`;
  }

  copyShareLink() {
    if (!this.isBrowser || !this.shareLink) {
      return;
    }

    navigator.clipboard.writeText(this.shareLink).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Lien copié',
        detail: 'Le lien de votre wishlist a été copié dans le presse-papier',
        life: 3000
      });
      this.shareModalVisible = false;
    });
  }

  shareOnSocial(platform: string) {
    if (!this.isBrowser || !this.shareLink) {
      return;
    }

    let url = '';
    const shareText = 'Découvrez ma wishlist LuxeAccessories !';
    const shareUrl = this.shareLink;
    
    switch(platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'pinterest':
        url = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
    }
    
    window.open(url, '_blank', 'width=600,height=400');
    this.shareModalVisible = false;
  }

  continueShopping() {
    this.router.navigate(['/products']);
  }

  getWishlistItemsInStock(): number {
    return this.wishlistItems.filter((product) => product.stock > 0).length;
  }

  addToWishlistFromRecommended(product: Product): void {
    this.wishlistService.addToWishlist(product);
    this.messageService.add({
      severity: 'success',
      summary: 'Ajoute aux favoris',
      detail: `${product.name} a ete ajoute a vos favoris`,
      life: 3000
    });
  }
}