import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import type { CartItem } from '../../shared/models/cart-item.model';

@Component({
  selector: 'app-checkout',
  imports: [ButtonModule, CardModule, CurrencyPipe, DividerModule, InputTextModule, ReactiveFormsModule, TagModule],
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
  readonly subtotal = computed(() => this.cartService.getCartTotal());
  readonly shipping = 8.99;
  readonly total = computed(() => this.subtotal() + this.shipping);

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

    const userId = this.authService.isLoggedIn() ? 1 : 0;
    const { address, phone } = this.form.getRawValue();

    this.orderService.placeOrder(userId, this.cartItems(), address, phone);
    this.cartService.clearCart();

    this.messageService.add({
      severity: 'success',
      summary: 'Commande confirmee',
      detail: 'Votre commande sera payee a la livraison.'
    });

    void this.router.navigate(['/profile']);
  }
}
