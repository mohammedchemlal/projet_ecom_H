import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { map } from 'rxjs';

import { PromoCodeService } from '../../core/services/promo-code.service';
import type { PromoCode } from '../../shared/models/promo-code.model';

@Component({
  selector: 'app-admin-promo-codes',
  imports: [
    ButtonModule,
    DatePipe,
    DatePickerModule,
    DialogModule,
    FormsModule,
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule
  ],
  templateUrl: './admin-promo-codes.component.html',
  styleUrl: './admin-promo-codes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPromoCodesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly promoCodeService = inject(PromoCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly promoCodes = signal<PromoCode[]>([]);
  readonly loading = signal(true);
  readonly promoDialog = signal(false);
  readonly isEditing = signal(false);
  readonly selectedPromo = signal<PromoCode | null>(null);

  private readonly expiredFilterActive = signal(false);

  readonly visiblePromoCodes = computed(() => {
    if (!this.expiredFilterActive()) {
      return this.promoCodes();
    }

    return this.promoCodes().filter((promo) => this.isExpired(promo.validTo));
  });

  readonly promoTypeOptions: Array<{ label: string; value: PromoCode['type'] }> = [
    { label: 'Pourcentage', value: 'percentage' },
    { label: 'Montant fixe', value: 'fixed' }
  ];

  readonly promoForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    discount: [0, [Validators.required, Validators.min(1), Validators.max(100)]],
    type: ['percentage' as PromoCode['type'], Validators.required],
    minOrderAmount: [0],
    maxDiscount: this.fb.control<number | null>(null),
    validFrom: [new Date(), Validators.required],
    validTo: [new Date(), Validators.required],
    usageLimit: this.fb.control<number | null>(null),
    usedCount: [0],
    isActive: [true]
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(map((params) => params.get('state') === 'expired'), takeUntilDestroyed(this.destroyRef))
      .subscribe((expiredOnly) => {
        this.expiredFilterActive.set(expiredOnly);
      });

    this.loadPromoCodes();
  }

  loadPromoCodes(): void {
    this.loading.set(true);
    this.promoCodeService.getPromoCodes().subscribe((codes) => {
      this.promoCodes.set(codes);
      this.loading.set(false);
    });
  }

  openNew(): void {
    this.isEditing.set(false);
    this.selectedPromo.set(null);
    this.promoForm.reset({
      code: '',
      discount: 0,
      type: 'percentage',
      minOrderAmount: 0,
      maxDiscount: null,
      validFrom: new Date(),
      validTo: new Date(),
      usageLimit: null,
      usedCount: 0,
      isActive: true
    });
    this.promoDialog.set(true);
  }

  editPromo(promo: PromoCode): void {
    this.isEditing.set(true);
    this.selectedPromo.set(promo);
    this.promoForm.patchValue({
      ...promo,
      validFrom: new Date(promo.validFrom),
      validTo: new Date(promo.validTo)
    });
    this.promoDialog.set(true);
  }

  deletePromo(promo: PromoCode): void {
    this.confirmationService.confirm({
      message: `Etes-vous sur de vouloir supprimer le code promo "${promo.code}" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.promoCodeService.deletePromoCode(promo.id).subscribe(() => {
          this.loadPromoCodes();
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Code promo supprime'
          });
        });
      }
    });
  }

  savePromo(): void {
    if (this.promoForm.invalid) {
      this.promoForm.markAllAsTouched();
      return;
    }

    const formValue = this.promoForm.getRawValue();
    const payload = {
      ...formValue,
      validFrom: formValue.validFrom ?? new Date(),
      validTo: formValue.validTo ?? new Date()
    } satisfies Omit<PromoCode, 'id'>;
    const selectedPromo = this.selectedPromo();

    if (this.isEditing() && selectedPromo) {
      this.promoCodeService.updatePromoCode(selectedPromo.id, payload).subscribe(() => {
        this.loadPromoCodes();
        this.messageService.add({
          severity: 'success',
          summary: 'Succes',
          detail: 'Code promo modifie'
        });
        this.promoDialog.set(false);
      });

      return;
    }

    this.promoCodeService.createPromoCode(payload).subscribe(() => {
      this.loadPromoCodes();
      this.messageService.add({
        severity: 'success',
        summary: 'Succes',
        detail: 'Code promo cree'
      });
      this.promoDialog.set(false);
    });
  }

  togglePromoStatus(promo: PromoCode, checked: boolean): void {
    this.promoCodeService.updatePromoCode(promo.id, { isActive: checked }).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Succes',
        detail: `Code promo ${checked ? 'active' : 'desactive'}`
      });
    });
  }

  isExpired(validTo: Date): boolean {
    return new Date(validTo).getTime() < Date.now();
  }
}
