import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';

import { CategoryService } from '../../core/services/category.service';
import type { CategoryOption } from '../../core/services/category.service';

@Component({
  selector: 'app-admin-categories',
  imports: [ButtonModule, DialogModule, InputTextModule, ReactiveFormsModule, TableModule, TextareaModule],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCategoriesComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly categories = signal<CategoryOption[]>([]);
  readonly loading = signal(true);
  readonly categoryDialog = signal(false);
  readonly isEditing = signal(false);
  readonly selectedCategory = signal<CategoryOption | null>(null);

  readonly categoryForm = this.fb.nonNullable.group({
    label: ['', Validators.required],
    value: ['', Validators.required],
    icon: [''],
    description: ['']
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.categoryService.getCategories().subscribe((categories) => {
      this.categories.set(categories);
      this.loading.set(false);
    });
  }

  openNew(): void {
    this.isEditing.set(false);
    this.selectedCategory.set(null);
    this.categoryForm.reset({
      label: '',
      value: '',
      icon: '',
      description: ''
    });
    this.categoryDialog.set(true);
  }

  editCategory(category: CategoryOption): void {
    this.isEditing.set(true);
    this.selectedCategory.set(category);
    this.categoryForm.patchValue({
      label: category.label,
      value: category.value,
      icon: category.icon,
      description: category.description
    });
    this.categoryDialog.set(true);
  }

  deleteCategory(category: CategoryOption): void {
    this.confirmationService.confirm({
      message: `Etes-vous sur de vouloir supprimer la categorie "${category.label}" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.categoryService.deleteCategory(category.id).subscribe(() => {
          this.categories.update((items) => items.filter((item) => item.id !== category.id));
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Categorie supprimee'
          });
        });
      }
    });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const payload = this.categoryForm.getRawValue();
    const selectedCategory = this.selectedCategory();

    if (this.isEditing() && selectedCategory) {
      this.categoryService.updateCategory(selectedCategory.id, payload).subscribe((updatedCategory) => {
        this.categories.update((items) => items.map((item) => (item.id === selectedCategory.id ? updatedCategory : item)));
        this.messageService.add({
          severity: 'success',
          summary: 'Succes',
          detail: 'Categorie modifiee'
        });
        this.categoryDialog.set(false);
      });

      return;
    }

    this.categoryService.createCategory(payload).subscribe((createdCategory) => {
      this.categories.update((items) => [...items, createdCategory]);
      this.messageService.add({
        severity: 'success',
        summary: 'Succes',
        detail: 'Categorie creee'
      });
      this.categoryDialog.set(false);
    });
  }
}
