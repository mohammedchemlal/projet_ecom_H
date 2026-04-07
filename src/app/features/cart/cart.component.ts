import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { RatingModule } from 'primeng/rating';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { CartItem } from '../../shared/models/cart-item.model';
import { Product } from '../../shared/models/product.model';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, FormsModule, RouterLink, RatingModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  isLoading = true;
  
  // Promo code
  promoCode = '';
  appliedPromo: { code: string; discount: number } | null = null;
  isApplyingPromo = false;
  
  // Recommended products
  recommendedProducts: Product[] = [];
  
  // Shipping
  shippingCost = 0;
  freeShippingThreshold = 50;
  
  // Payment methods
  paymentMethods = [
    { label: 'Paiement à la livraison', value: 'cod', icon: 'pi-wallet' }
  ];
  selectedPaymentMethod = 'cod';

  // Available promo codes
  availablePromoCodes = [
    { code: 'WELCOME10', discount: 10, type: 'percentage' },
    { code: 'SAVE20', discount: 20, type: 'percentage' },
    { code: 'FREESHIP', discount: 5, type: 'fixed' }
  ];

  constructor(
    private cartService: CartService,
    private wishlistService: WishlistService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCart();
    this.loadRecommendedProducts();
  }

  ngOnDestroy() {
    // Cleanup
  }

  loadCart() {
    this.isLoading = true;
    this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.isLoading = false;
    });
  }

  loadRecommendedProducts() {
    // Mock recommended products based on cart items
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
      }
    ];
  }

  updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity < 1) return;
    if (newQuantity > item.product.stock) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock insuffisant',
        detail: `Stock disponible: ${item.product.stock}`
      });
      return;
    }
    this.cartService.updateQuantity(item.productId, newQuantity);
  }

  removeItem(item: CartItem) {
    this.messageService.add({
      severity: 'success',
      summary: 'Produit supprimé',
      detail: `${item.product.name} a été retiré de votre panier`,
      life: 3000
    });
    this.cartService.removeFromCart(item.productId);
  }

  applyPromoCode() {
    if (!this.promoCode.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Code promo vide',
        detail: 'Veuillez entrer un code promo'
      });
      return;
    }

    this.isApplyingPromo = true;
    
    // Simulate API call
    setTimeout(() => {
      const found = this.availablePromoCodes.find(
        p => p.code === this.promoCode.toUpperCase()
      );

      if (found) {
        this.appliedPromo = { code: found.code, discount: found.discount };
        this.messageService.add({
          severity: 'success',
          summary: 'Code appliqué',
          detail: `Code ${found.code} appliqué avec succès !`
        });
        this.promoCode = '';
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Code invalide',
          detail: 'Ce code promo n\'existe pas ou a expiré'
        });
      }
      this.isApplyingPromo = false;
    }, 800);
  }

  removePromoCode() {
    this.appliedPromo = null;
    this.messageService.add({
      severity: 'info',
      summary: 'Code retiré',
      detail: 'Le code promo a été retiré'
    });
  }

  getSubtotal(): number {
    return this.cartItems.reduce((total, item) => {
      const price = item.product.discountPrice || item.product.price;
      return total + (price * item.quantity);
    }, 0);
  }

  getDiscountAmount(): number {
    if (!this.appliedPromo) return 0;
    
    const subtotal = this.getSubtotal();
    // For simplicity, assuming percentage discount
    return (subtotal * this.appliedPromo.discount) / 100;
  }

  getShippingCost(): number {
    const subtotal = this.getSubtotal() - this.getDiscountAmount();
    if (subtotal >= this.freeShippingThreshold) return 0;
    return this.shippingCost;
  }

  getTotal(): number {
    return this.getSubtotal() - this.getDiscountAmount() + this.getShippingCost();
  }

  getItemTotal(item: CartItem): number {
    const price = item.product.discountPrice || item.product.price;
    return price * item.quantity;
  }

  moveToWishlist(item: CartItem) {
    this.wishlistService.addToWishlist(item.product);
    this.cartService.removeFromCart(item.productId);
    this.messageService.add({
      severity: 'success',
      summary: 'Déplacé vers favoris',
      detail: `${item.product.name} a été déplacé vers votre liste d'envies`
    });
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product, 1);
    this.messageService.add({
      severity: 'success',
      summary: 'Ajouté au panier',
      detail: `${product.name} a été ajouté à votre panier`
    });
  }

  proceedToCheckout() {
    if (this.cartItems.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Panier vide',
        detail: 'Ajoutez des produits avant de passer commande'
      });
      return;
    }
    this.router.navigate(['/checkout']);
  }

  continueShopping() {
    this.router.navigate(['/products']);
  }

  getDiscountedPrice(product: Product): number {
    return product.discountPrice || product.price;
  }

  getDiscountPercentage(product: Product): number {
    if (!product.discountPrice) return 0;
    return Math.round(((product.price - product.discountPrice) / product.price) * 100);
  }

  isEmpty(): boolean {
    return this.cartItems.length === 0;
  }
}