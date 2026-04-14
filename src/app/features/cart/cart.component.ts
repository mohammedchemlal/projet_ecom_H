import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { RatingModule } from 'primeng/rating';
import { Subscription } from 'rxjs';
import { CartService, type CartPromo } from '../../core/services/cart.service';
import { PromoCodeService } from '../../core/services/promo-code.service';
import { ProductService } from '../../core/services/product.service';
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
  appliedPromo: CartPromo | null = null;
  isApplyingPromo = false;
  
  // Recommended products
  recommendedProducts: Product[] = [];
  
  // Shipping
  shippingCost = 0;
  
  // Payment methods
  paymentMethods = [
    { label: 'Paiement à la livraison', value: 'cod', icon: 'pi-wallet' }
  ];
  selectedPaymentMethod = 'cod';

  private cartSubscription?: Subscription;
  private promoSubscription?: Subscription;

  // Available promo codes
  readonly availablePromoCodes: Array<{ code: string; discount: number; type: CartPromo['type'] }> = [
    { code: 'WELCOME10', discount: 10, type: 'percentage' },
    { code: 'SAVE20', discount: 20, type: 'percentage' },
    { code: 'FREESHIP', discount: 5, type: 'fixed' }
  ];

  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private wishlistService: WishlistService,
    private messageService: MessageService,
    private router: Router,
    private promoService: PromoCodeService
  ) {}

  ngOnInit() {
    this.loadCart();
    this.loadPromo();
    this.loadRecommendedProducts();
  }

  ngOnDestroy() {
    this.cartSubscription?.unsubscribe();
    this.promoSubscription?.unsubscribe();
  }

  loadCart() {
    this.isLoading = true;
    this.cartSubscription?.unsubscribe();
    this.cartSubscription = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.isLoading = false;
    });
  }

  loadPromo() {
    this.promoSubscription?.unsubscribe();
    this.promoSubscription = this.cartService.appliedPromo$.subscribe((promo) => {
      this.appliedPromo = promo;
    });
  }

  loadRecommendedProducts() {
    this.productService.getFeaturedProducts().subscribe((products) => {
      this.recommendedProducts = products.filter((product) => product.isActive).slice(0, 4);
    });
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

    // Simulate API latency
    setTimeout(() => {
      const input = (this.promoCode ?? '').toString();
      const normalized = input.replace(/[^a-z0-9]/gi, '').toUpperCase();

      const promo = this.promoService.validate(normalized);

      if (!promo) {
        this.messageService.add({ severity: 'error', summary: 'Code invalide', detail: "Ce code promo n'existe pas." });
        this.isApplyingPromo = false;
        return;
      }

      // check active
      if (!promo.isActive) {
        this.messageService.add({ severity: 'error', summary: 'Code inactif', detail: 'Ce code promo est désactivé.' });
        this.isApplyingPromo = false;
        return;
      }

      const now = Date.now();
      if (promo.validTo.getTime() < now) {
        this.messageService.add({ severity: 'error', summary: 'Expiré', detail: 'Ce code promo a expiré.' });
        this.isApplyingPromo = false;
        return;
      }

      const subtotal = this.getSubtotal();
      if (subtotal < (promo.minOrderAmount || 0)) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Montant minimum',
          detail: `Le panier doit atteindre ${promo.minOrderAmount} DH pour utiliser ce code.`
        });
        this.isApplyingPromo = false;
        return;
      }

      if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
        this.messageService.add({ severity: 'error', summary: 'Limite atteinte', detail: 'Ce code a atteint sa limite d\'utilisation.' });
        this.isApplyingPromo = false;
        return;
      }

      // All checks passed
      this.cartService.setAppliedPromo({ code: promo.code, discount: promo.discount, type: promo.type });
      this.messageService.add({ severity: 'success', summary: 'Code appliqué', detail: `Code ${promo.code} appliqué avec succès !` });
      this.promoCode = '';
      this.isApplyingPromo = false;
    }, 600);
  }

  removePromoCode() {
    this.cartService.clearPromoCode();
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

    if (this.appliedPromo.type === 'fixed') {
      return Math.min(subtotal, this.appliedPromo.discount);
    }

    return (subtotal * this.appliedPromo.discount) / 100;
  }

  getShippingCost(): number {
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

  trackById(index: number, item: any): any {
    return item?.productId ?? item?.id ?? index;
  }
}