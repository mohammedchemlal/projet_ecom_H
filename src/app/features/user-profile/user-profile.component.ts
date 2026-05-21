import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { SavedCartService } from '../../core/services/saved-cart.service';
import { User } from '../../shared/models/user.model';
import { Order } from '../../shared/models/order.model';
import type { SavedCart } from '../../shared/models/saved-cart.model';

@Component({
  selector: 'app-user-profile',
  imports: [
    ButtonModule,
    CommonModule,
    CurrencyPipe,
    DialogModule,
    FormsModule,
    InputTextModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit, OnDestroy {
  activeTab: 'profile' | 'orders' | 'security' | 'saved-carts' = 'profile';
  currentUser: User | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  orders: Order[] = [];
  savedCarts: SavedCart[] = [];
  isLoadingSavedCarts = false;
  isLoading = true;
  isSaving = false;
  
  // Statistics
  stats = {
    totalOrders: 0,
    totalSpent: 0,
    favoriteCategory: '',
    memberSince: ''
  };
  
  // Order filter
  orderStatusFilter: string = 'all';
  orderStatuses = [
    { label: 'Toutes', value: 'all' },
    { label: 'En attente', value: 'pending' },
    { label: 'Confirmée', value: 'confirmed' },
    { label: 'Livrée', value: 'delivered' },
    { label: 'Annulée', value: 'cancelled' }
  ];
  
  // Edit mode
  isEditing = false;
  
  // Avatar
  selectedAvatar: string | null = null;
  avatars = [
    '/avatars/avatar-rose.svg',
    '/avatars/avatar-navy.svg',
    '/avatars/avatar-gold.svg',
    '/avatars/avatar-emerald.svg',
    '/avatars/avatar-terracotta.svg',
    '/avatars/avatar-ink.svg'
  ];
  showAvatarModal = false;

  // Password visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Delete account
  showDeleteModal = false;
  deleteConfirmText = '';

  // Order details
  showOrderDetailsModal = false;
  selectedOrder: Order | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private cartService: CartService,
    private orderService: OrderService,
    private savedCartService: SavedCartService,
    private messageService: MessageService,
    public router: Router
  ) {
    this.initForms();
  }

  ngOnInit() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params.get('tab');

      if (tab === 'orders' || tab === 'security' || tab === 'profile' || tab === 'saved-carts') {
        this.activeTab = tab;
      }
    });

    this.loadUserData();
    this.loadOrders();
  }

  ngOnDestroy() {
    // Cleanup
  }

  initForms() {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9+]{10,15}$')]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required]],
      postalCode: ['', [Validators.required, Validators.pattern('^[0-9]{5}$')]],
      country: ['', [Validators.required]]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: FormGroup): any {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      // Parse address if exists
      const addressParts = this.currentUser.address?.split('|') || ['', '', '', ''];
      
      this.profileForm.patchValue({
        fullName: this.currentUser.fullName,
        email: this.currentUser.email,
        phone: this.currentUser.phone,
        address: addressParts[0] || '',
        city: addressParts[1] || '',
        postalCode: addressParts[2] || '',
        country: addressParts[3] || 'France'
      });
      
      // Load saved avatar
      const savedAvatar = localStorage.getItem('userAvatar');
      this.selectedAvatar = savedAvatar && this.avatars.includes(savedAvatar) ? savedAvatar : this.avatars[0];
      
      // Calculate member since
      this.stats.memberSince = new Date(this.currentUser.createdAt).toLocaleDateString('fr-MA', {
        year: 'numeric',
        month: 'long'
      });
    }
  }

  loadOrders() {
    this.isLoading = true;
    this.orderService.getUserOrders().subscribe(orders => {
      this.orders = orders;
      this.calculateStats();
      this.isLoading = false;
    });
  }

  calculateStats() {
    this.stats.totalOrders = this.orders.length;
    this.stats.totalSpent = this.orders.reduce((sum, order) => sum + order.total, 0);
    
    // Find favorite category
    const categoryCount: { [key: string]: number } = {};
    this.orders.forEach(order => {
      order.items.forEach(item => {
        const category = item.product.category;
        categoryCount[category] = (categoryCount[category] || 0) + item.quantity;
      });
    });
    
    let maxCount = 0;
    let favoriteCategory = '';
    for (const [category, count] of Object.entries(categoryCount)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = category;
      }
    }
    
    const categoryNames: { [key: string]: string } = {
      necklaces: 'Colliers',
      rings: 'Bagues',
      bracelets: 'Bracelets',
      earrings: 'Boucles d\'oreilles'
    };
    
    this.stats.favoriteCategory = categoryNames[favoriteCategory] || '-';
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      Object.keys(this.profileForm.controls).forEach(key => {
        this.profileForm.get(key)?.markAsTouched();
      });
      this.messageService.add({
        severity: 'error',
        summary: 'Formulaire invalide',
        detail: 'Veuillez corriger les erreurs'
      });
      return;
    }

    this.isSaving = true;
    
    const formValue = this.profileForm.value;
    const address = `${formValue.address}|${formValue.city}|${formValue.postalCode}|${formValue.country}`;
    
    const updateData = {
      fullName: formValue.fullName,
      email: formValue.email,
      phone: formValue.phone,
      address: address
    };
    
    this.authService.updateProfile(updateData).subscribe({
      next: (updatedUser) => {
        this.currentUser = updatedUser;
        this.messageService.add({
          severity: 'success',
          summary: 'Profil mis à jour',
          detail: 'Vos informations ont été modifiées avec succès'
        });
        this.isEditing = false;
        this.isSaving = false;
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message || 'Une erreur est survenue'
        });
        this.isSaving = false;
      }
    });
  }

  changePassword() {
    if (this.passwordForm.invalid) {
      Object.keys(this.passwordForm.controls).forEach(key => {
        this.passwordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSaving = true;

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();

    this.authService.changePassword(currentPassword, newPassword, confirmPassword).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Mot de passe modifié',
          detail: 'Votre mot de passe a été mis à jour'
        });
        this.passwordForm.reset();
        this.isSaving = false;
      },
      error: (error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message || 'Impossible de modifier le mot de passe'
        });
        this.isSaving = false;
      }
    });
  }

  changeAvatar(avatar: string) {
    this.selectedAvatar = avatar;
    localStorage.setItem('userAvatar', avatar);
    this.showAvatarModal = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Avatar modifié',
      detail: 'Votre photo de profil a été mise à jour'
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.loadUserData();
  }

  viewOrderDetails(order: Order) {
    this.selectedOrder = order;
    this.showOrderDetailsModal = true;
  }

  closeOrderDetailsModal() {
    this.showOrderDetailsModal = false;
    this.selectedOrder = null;
  }

  getOrderItemLineTotal(order: Order, productId: number): number {
    const item = order.items.find((entry) => entry.productId === productId);
    if (!item) {
      return 0;
    }

    const unitPrice = item.product.discountPrice || item.product.price;
    return unitPrice * item.quantity;
  }

  getOrderItemsSubtotal(order: Order): number {
    return order.items.reduce((sum, item) => {
      const unitPrice = item.product.discountPrice || item.product.price;
      return sum + unitPrice * item.quantity;
    }, 0);
  }

  getOrderDiscount(order: Order): number {
    const subtotal = this.getOrderItemsSubtotal(order);
    return subtotal > order.total ? subtotal - order.total : 0;
  }

  getOrderShipping(order: Order): number {
    return 0;
  }

  deleteAccount() {
    if (this.deleteConfirmText !== 'SUPPRIMER') {
      this.messageService.add({
        severity: 'error',
        summary: 'Confirmation incorrecte',
        detail: 'Veuillez taper SUPPRIMER pour confirmer'
      });
      return;
    }

    this.isSaving = true;

    this.authService.deleteMyAccount().subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Compte supprimé',
          detail: 'Votre compte a été supprimé'
        });
        this.showDeleteModal = false;
        this.deleteConfirmText = '';
        this.isSaving = false;
        this.router.navigate(['/home']);
      },
      error: (error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message || 'Impossible de supprimer le compte'
        });
        this.isSaving = false;
      }
    });
  }

  cancelOrder(order: Order): void {
    if (!confirm('Voulez-vous vraiment annuler cette commande ? Le stock sera remis a jour.')) {
      return;
    }

    this.orderService.cancelOrder(order.id).subscribe({
      next: (updatedOrder) => {
        if (updatedOrder) {
          this.orders = this.orders.map((o) => (o.id === order.id ? updatedOrder : o));
          this.messageService.add({
            severity: 'success',
            summary: 'Commande annulée',
            detail: `La commande #${order.id} a été annulée.`,
            life: 4000
          });
        }
      },
      error: (error) => {
        const msg = error.error?.message || error.message || 'Erreur lors de l\'annulation.';
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: msg,
          life: 5000
        });
      }
    });
  }

  getFilteredOrders(): Order[] {
    if (this.orderStatusFilter === 'all') {
      return this.orders;
    }
    return this.orders.filter(order => order.status === this.orderStatusFilter);
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return statusMap[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
      pending: 'warn',
      confirmed: 'info',
      delivered: 'success',
      cancelled: 'danger'
    };
    return severityMap[status] || 'secondary';
  }

  loadSavedCarts(): void {
    this.isLoadingSavedCarts = true;
    this.savedCartService.getAll().subscribe({
      next: (carts) => {
        this.savedCarts = carts;
        this.isLoadingSavedCarts = false;
      },
      error: () => {
        this.savedCarts = [];
        this.isLoadingSavedCarts = false;
      }
    });
  }

  restoreSavedCart(cart: SavedCart): void {
    this.cartService.clearCart();
    cart.items.forEach((item) => {
      this.cartService.addToCart(item.product, item.quantity);
    });
    if (cart.promo) {
      this.cartService.applyPromoFromSaved(cart.promo);
    }
    this.savedCartService.remove(cart.id).subscribe({
      next: () => {
        this.savedCarts = this.savedCarts.filter((c) => c.id !== cart.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Panier restauré',
          detail: 'Votre panier a été restauré. Rendez-vous dans le panier pour finaliser.',
          life: 4000
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Panier restauré',
          detail: 'Votre panier a été restauré.',
          life: 4000
        });
      }
    });
  }

  deleteSavedCart(cart: SavedCart): void {
    this.savedCartService.remove(cart.id).subscribe({
      next: () => {
        this.savedCarts = this.savedCarts.filter((c) => c.id !== cart.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Panier supprimé',
          detail: 'Le panier sauvegardé a été supprimé.',
          life: 3000
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de supprimer le panier.',
          life: 3000
        });
      }
    });
  }

  getSavedCartTotal(cart: SavedCart): number {
    return (cart.items ?? []).reduce((sum, item) => {
      const price = item.product.discountPrice || item.product.price;
      return sum + price * item.quantity;
    }, 0);
  }

  getSavedCartCount(cart: SavedCart): number {
    return (cart.items ?? []).length;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}