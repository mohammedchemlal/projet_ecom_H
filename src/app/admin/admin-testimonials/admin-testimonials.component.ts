import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormBuilder } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RatingModule } from 'primeng/rating';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { TestimonialService } from '../../core/services/testimonial.service';
import { AdminRefreshService } from '../../core/services/admin-refresh.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Testimonial } from '../../shared/models/product.model';

@Component({
  selector: 'app-admin-testimonials',
  imports: [
    ButtonModule,
    DialogModule,
    DatePipe,
    InputNumberModule,
    InputTextModule,
    RatingModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule
  ],
  templateUrl: './admin-testimonials.component.html',
  styleUrl: './admin-testimonials.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTestimonialsComponent implements OnInit {
  private readonly testimonialService = inject(TestimonialService);
  private readonly adminRefresh = inject(AdminRefreshService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly testimonials = signal<Testimonial[]>([]);
  readonly loading = signal(true);
  readonly dialogVisible = signal(false);
  readonly isEditing = signal(false);
  readonly selectedTestimonial = signal<Testimonial | null>(null);

  readonly activeTestimonials = computed(() => this.testimonials().filter((testimonial) => testimonial.isActive !== false));

  readonly testimonialForm = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2)]],
    customerImage: [''],
    role: [''],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.minLength(3)]],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    isActive: [true]
  });

  ngOnInit(): void {
    this.loadTestimonials();
    this.adminRefresh.on('testimonials').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadTestimonials());
  }

  loadTestimonials(): void {
    this.loading.set(true);
    this.testimonialService.getAdminTestimonials().subscribe({
      next: (testimonials) => {
        this.testimonials.set(testimonials);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message
        });
      }
    });
  }

  openNew(): void {
    this.isEditing.set(false);
    this.selectedTestimonial.set(null);
    this.testimonialForm.reset({
      customerName: '',
      customerImage: '/avatars/avatar-rose.svg',
      role: '',
      rating: 5,
      comment: '',
      sortOrder: this.testimonials().length,
      isActive: true
    });
    this.dialogVisible.set(true);
  }

  editTestimonial(testimonial: Testimonial): void {
    this.isEditing.set(true);
    this.selectedTestimonial.set(testimonial);
    this.testimonialForm.patchValue({
      customerName: testimonial.customerName,
      customerImage: testimonial.customerImage,
      role: testimonial.role ?? '',
      rating: testimonial.rating,
      comment: testimonial.comment,
      sortOrder: Math.max(this.testimonials().findIndex((item) => item.id === testimonial.id), 0),
      isActive: testimonial.isActive !== false
    });
    this.dialogVisible.set(true);
  }

  deleteTestimonial(testimonial: Testimonial): void {
    this.confirmationService.confirm({
      message: `Supprimer le témoignage de "${testimonial.customerName}" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.testimonialService.deleteTestimonial(testimonial.id).subscribe({
          next: () => {
            this.testimonials.update((items) => items.filter((item) => item.id !== testimonial.id));
            this.messageService.add({
              severity: 'success',
              summary: 'Succès',
              detail: 'Témoignage supprimé'
            });
          },
          error: (error: Error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: error.message
            });
          }
        });
      }
    });
  }

  saveTestimonial(): void {
    if (this.testimonialForm.invalid) {
      this.testimonialForm.markAllAsTouched();
      return;
    }

    const formValue = this.testimonialForm.getRawValue();
    const payload = {
      customerName: formValue.customerName.trim(),
      customerImage: formValue.customerImage.trim() || '/avatars/avatar-ink.svg',
      role: formValue.role.trim() || undefined,
      rating: formValue.rating,
      comment: formValue.comment.trim(),
      isActive: formValue.isActive,
      sortOrder: formValue.sortOrder
    };

    const selectedTestimonial = this.selectedTestimonial();

    if (this.isEditing() && selectedTestimonial) {
      this.testimonialService.updateTestimonial(selectedTestimonial.id, payload).subscribe({
        next: (updatedTestimonial) => {
          this.testimonials.update((items) =>
            items.map((item) => (item.id === selectedTestimonial.id ? updatedTestimonial : item))
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Témoignage modifié'
          });
          this.dialogVisible.set(false);
        },
        error: (error: Error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: error.message
          });
        }
      });

      return;
    }

    this.testimonialService.createTestimonial(payload).subscribe({
      next: (createdTestimonial) => {
        this.testimonials.update((items) => [createdTestimonial, ...items]);
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Témoignage créé'
        });
        this.dialogVisible.set(false);
      },
      error: (error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message
        });
      }
    });
  }

  toggleActive(testimonial: Testimonial, checked: boolean): void {
    this.testimonialService.updateTestimonial(testimonial.id, { isActive: checked }).subscribe({
      next: (updatedTestimonial) => {
        this.testimonials.update((items) => items.map((item) => (item.id === testimonial.id ? updatedTestimonial : item)));
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: `Témoignage ${checked ? 'activé' : 'désactivé'}`
        });
      },
      error: (error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message
        });
      }
    });
  }

  getAvatar(testimonial: Testimonial): string {
    return testimonial.customerImage || '/avatars/avatar-ink.svg';
  }
}
