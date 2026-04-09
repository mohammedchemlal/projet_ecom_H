import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../core/services/auth.service';
import { CartService, type CartPromo } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import type { CartItem } from '../../shared/models/cart-item.model';

@Component({
  selector: 'app-checkout',
  imports: [ButtonModule, CardModule, CurrencyPipe, DividerModule, InputTextModule, ReactiveFormsModule, RouterLink, TagModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly cartItems = toSignal(this.cartService.cartItems$, { initialValue: [] as CartItem[] });
  readonly appliedPromo = toSignal(this.cartService.appliedPromo$, { initialValue: null as CartPromo | null });
  readonly subtotal = computed(() =>
    this.cartItems().reduce((total, item) => {
      const price = item.product.discountPrice || item.product.price;
      return total + price * item.quantity;
    }, 0)
  );
  readonly discount = computed(() => {
    const promo = this.appliedPromo();

    if (!promo) {
      return 0;
    }

    const subtotal = this.subtotal();

    if (promo.type === 'fixed') {
      return Math.min(subtotal, promo.discount);
    }

    return (subtotal * promo.discount) / 100;
  });
  readonly shipping = 0;
  readonly total = computed(() => Math.max(this.subtotal() - this.discount() + this.shipping, 0));

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    address: ['', [Validators.required, Validators.minLength(8)]],
    phone: ['', [Validators.required, Validators.minLength(6)]]
  });

  submitOrder(): void {
    if (this.form.invalid || this.cartItems().length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.authService.getCurrentUser()?.id ?? 0;

    if (userId === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Session requise',
        detail: 'Veuillez vous reconnecter pour finaliser la commande.'
      });

      void this.router.navigate(['/auth/login']);
      return;
    }

    const { address, phone } = this.form.getRawValue();
    const promo = this.appliedPromo();

    this.orderService
      .placeOrder(userId, this.cartItems(), address, phone, this.total(), promo?.code, this.discount())
      .subscribe({
        next: () => {
          this.cartService.clearCart();
          this.messageService.add({
            severity: 'success',
            summary: 'Commande confirmée',
            detail: 'Votre commande a été enregistrée et sera payée à la livraison.'
          });
          void this.router.navigate(['/profile'], { queryParams: { tab: 'orders' } });
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Session expirée',
              detail: 'Veuillez vous reconnecter pour finaliser la commande.'
            });

            void this.router.navigate(['/auth/login']);
            return;
          }

          const detail = err instanceof Error ? err.message : 'Erreur lors de la validation de la commande.';
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
        }
      });
  }
}
