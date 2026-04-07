import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../../core/services/auth.service';
import { OrderService } from '../../core/services/order.service';
import { User } from '../../shared/models/user.model';
import { Order } from '../../shared/models/order.model';

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
  activeTab: 'profile' | 'orders' | 'security' = 'profile';
  currentUser: User | null = null;
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  orders: Order[] = [];
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
    { label: 'Livrée', value: 'delivered' }
  ];
  
  // Edit mode
  isEditing = false;
  
  // Avatar
  selectedAvatar: string | null = null;
  avatars = [
    'https://randomuser.me/api/portraits/women/1.jpg',
    'https://randomuser.me/api/portraits/women/2.jpg',
    'https://randomuser.me/api/portraits/women/3.jpg',
    'https://randomuser.me/api/portraits/women/4.jpg',
    'https://randomuser.me/api/portraits/women/5.jpg',
    'https://randomuser.me/api/portraits/men/1.jpg',
    'https://randomuser.me/api/portraits/men/2.jpg',
    'https://randomuser.me/api/portraits/men/3.jpg'
  ];
  showAvatarModal = false;

  // Password visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Delete account
  showDeleteModal = false;
  deleteConfirmText = '';

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private orderService: OrderService,
    private messageService: MessageService,
    public router: Router
  ) {
    this.initForms();
  }

  ngOnInit() {
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
      this.selectedAvatar = savedAvatar || this.avatars[0];
      
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
    
    // Simulate password change
    setTimeout(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Mot de passe modifié',
        detail: 'Votre mot de passe a été mis à jour'
      });
      this.passwordForm.reset();
      this.isSaving = false;
    }, 1000);
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
    this.router.navigate(['/order', order.id]);
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
      delivered: 'Livrée'
    };
    return statusMap[status] || status;
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
      pending: 'warn',
      confirmed: 'info',
      delivered: 'success'
    };
    return severityMap[status] || 'secondary';
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
    
    // Simulate account deletion
    this.messageService.add({
      severity: 'success',
      summary: 'Compte supprimé',
      detail: 'Votre compte a été supprimé'
    });
    this.authService.logout();
    this.router.navigate(['/home']);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}