import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { map } from 'rxjs';

import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { ConfirmationService } from 'primeng/api';
import type { Product } from '../../shared/models/product.model';
import type { CategoryOption } from '../../core/services/category.service';

@Component({
  selector: 'app-admin-products',
  imports: [
    ButtonModule,
    CurrencyPipe,
    DialogModule,
    FileUploadModule,
    FormsModule,
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule
  ],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminProductsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly products = toSignal(this.productService.getProducts(), { initialValue: [] as Product[] });
  readonly categories = toSignal(this.categoryService.getCategories(), { initialValue: [] as CategoryOption[] });
  readonly dialogVisible = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly uploadedImages = signal<string[]>([]);
  readonly searchQuery = signal('');
  readonly selectedCategory = signal('');

  readonly productForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    price: [0, [Validators.required, Validators.min(0)]],
    discountPrice: this.fb.control<number | null>(null),
    category: ['', Validators.required],
    stock: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
    isPromotion: [false],
    promotionPercentage: this.fb.control<number | null>(null)
  });

  readonly dialogTitle = computed(() => (this.selectedProduct() ? 'Modifier le produit' : 'Nouveau produit'));
  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.selectedCategory();
    const lowStockOnly = this.lowStockFilterActive();

    return this.products().filter((product) => {
      const matchesQuery =
        !query || product.name.toLowerCase().includes(query) || (product.description ?? '').toLowerCase().includes(query);
      const matchesCategory = !category || product.category === category;
      const matchesLowStock = !lowStockOnly || product.stock <= 10;

      return matchesQuery && matchesCategory && matchesLowStock;
    });
  });

  private readonly lowStockFilterActive = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('stock') === 'low')),
    { initialValue: false }
  );

  readonly totalCount = computed(() => this.products().length);
  readonly promotionCount = computed(() => this.products().filter((product) => product.isPromotion).length);
  readonly lowStockCount = computed(() => this.products().filter((product) => product.stock <= 5).length);

  private readonly placeholderImage =
    'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80';

  readonly categoryOptions = computed(() => this.categories());

  openCreate(): void {
    this.selectedProduct.set(null);
    this.uploadedImages.set([]);
    this.productForm.reset({
      name: '',
      description: '',
      price: 0,
      discountPrice: null,
      category: '',
      stock: 0,
      isActive: true,
      isPromotion: false,
      promotionPercentage: null
    });
    this.dialogVisible.set(true);
  }

  openEdit(product: Product): void {
    this.selectedProduct.set(product);
    this.uploadedImages.set(product.images?.length ? [...product.images] : product.image ? [product.image] : []);
    this.productForm.patchValue({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      discountPrice: product.discountPrice ?? null,
      category: product.category,
      stock: product.stock,
      isActive: product.isActive,
      isPromotion: Boolean(product.isPromotion),
      promotionPercentage: product.promotionPercentage ?? null
    });
    this.dialogVisible.set(true);
  }

  save(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const rawValue = this.productForm.getRawValue();
    const images = this.uploadedImages().length > 0 ? [...this.uploadedImages()] : [this.placeholderImage];
    const payload = {
      name: rawValue.name?.trim() ?? '',
      description: rawValue.description?.trim() ?? '',
      price: rawValue.price ?? 0,
      discountPrice: rawValue.isPromotion ? rawValue.discountPrice ?? undefined : undefined,
      category: rawValue.category ?? '',
      stock: rawValue.stock ?? 0,
      images,
      image: images[0],
      rating: this.selectedProduct()?.rating ?? 0,
      reviewCount: this.selectedProduct()?.reviewCount ?? 0,
      isActive: rawValue.isActive ?? true,
      isPromotion: rawValue.isPromotion ?? false,
      promotionPercentage: rawValue.isPromotion ? rawValue.promotionPercentage ?? undefined : undefined
    };

    if (this.selectedProduct()) {
      this.productService.updateProduct(this.selectedProduct()!.id, payload).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit modifié.' });
      });
    } else {
      this.productService.createProduct(payload).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit créé.' });
      });
    }

    this.dialogVisible.set(false);
  }

  deleteProduct(product: Product): void {
    this.confirmationService.confirm({
      message: `Supprimer le produit \"${product.name}\" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.productService.deleteProduct(product.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit supprimé.' });
        });
      }
    });
  }

  toggleProductStatus(product: Product): void {
    this.productService.toggleProductStatus(product.id).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Succès',
        detail: `Produit ${product.isActive ? 'activé' : 'désactivé'}`
      });
    });
  }

  togglePromotion(product: Product): void {
    this.selectedProduct.set(product);
    this.uploadedImages.set(product.images?.length ? [...product.images] : product.image ? [product.image] : []);
    this.productForm.patchValue({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      discountPrice: product.discountPrice ?? Math.round(product.price * 0.85),
      category: product.category,
      stock: product.stock,
      isActive: product.isActive,
      isPromotion: true,
      promotionPercentage: product.promotionPercentage ?? 15
    });
    this.dialogVisible.set(true);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedCategory.set(target?.value ?? '');
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('');
  }

  onImageUpload(event: { files: File[] }): void {
    for (const file of event.files) {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result === 'string') {
          this.uploadedImages.update((images) => [...images, result]);
        }
      };

      reader.readAsDataURL(file);
    }
  }

  removeImage(index: number): void {
    this.uploadedImages.update((images) => images.filter((_, imageIndex) => imageIndex !== index));
  }

  getCategoryLabel(categoryValue: string): string {
    return this.categories().find((category) => category.value === categoryValue)?.label ?? categoryValue;
  }

  getPrimaryImage(product: Product): string {
    return product.images?.[0] ?? product.image ?? this.placeholderImage;
  }
}
