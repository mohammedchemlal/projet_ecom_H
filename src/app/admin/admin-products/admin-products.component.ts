import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
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
import { AdminRefreshService } from '../../core/services/admin-refresh.service';
import { ConfirmationService } from 'primeng/api';
import type { Product, ProductSpecificationSection } from '../../shared/models/product.model';
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
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly adminRefresh = inject(AdminRefreshService);
  private readonly categoryService = inject(CategoryService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  // Use the service's products$ BehaviorSubject so updates propagate automatically
  readonly products = toSignal(this.productService.products$, { initialValue: [] as Product[] });
  readonly categories = toSignal(this.categoryService.getCategories(), { initialValue: [] as CategoryOption[] });
  readonly dialogVisible = signal(false);
  readonly quickEditorVisible = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly quickEditorProduct = signal<Product | null>(null);
  readonly uploadedImages = signal<string[]>([]);
  readonly specificationSections = signal<ProductSpecificationSection[]>([]);
  readonly quickSpecificationSections = signal<ProductSpecificationSection[]>([]);
  readonly quickDetailedDescription = signal('');
  readonly searchQuery = signal('');
  readonly selectedCategory = signal('');

  readonly productForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    detailedDescription: [''],
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
  private readonly maxImageCount = 4;
  private readonly maxSourceFileSize = 5 * 1024 * 1024;
  // Keep a backend-aligned limit (bytes) to avoid frontend/backend mismatch
  private readonly backendMaxSourceFileSize = 2 * 1024 * 1024;
  private readonly maxImageWidth = 1280;
  private readonly imageQuality = 0.82;

  readonly categoryOptions = computed(() => this.categories());

  openCreate(): void {
    this.selectedProduct.set(null);
    this.uploadedImages.set([]);
    this.productForm.reset({
      name: '',
      description: '',
      detailedDescription: '',
      price: 0,
      discountPrice: null,
      category: '',
      stock: 0,
      isActive: true,
      isPromotion: false,
      promotionPercentage: null
    });
    this.specificationSections.set([]);
    this.dialogVisible.set(true);
  }

  openEdit(product: Product): void {
    this.selectedProduct.set(product);
    this.uploadedImages.set(product.images?.length ? [...product.images] : product.image ? [product.image] : []);
    this.productForm.patchValue({
      name: product.name,
      description: product.description ?? '',
      detailedDescription: product.detailedDescription ?? product.description ?? '',
      price: product.price,
      discountPrice: product.discountPrice ?? null,
      category: product.category,
      stock: product.stock,
      isActive: product.isActive,
      isPromotion: Boolean(product.isPromotion),
      promotionPercentage: product.promotionPercentage ?? null
    });
    this.specificationSections.set(this.normalizeSpecificationSections(product.specifications));
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
      detailedDescription: rawValue.detailedDescription?.trim() ?? rawValue.description?.trim() ?? '',
      specifications: this.normalizeSpecificationSections(this.specificationSections()),
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
      this.productService.updateProduct(this.selectedProduct()!.id, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit modifié.' });
          this.dialogVisible.set(false);
          this.adminRefresh.notify('products');
        },
        error: (error: Error) => {
          this.handleRequestError(error);
        }
      });
    } else {
      this.productService.createProduct(payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit créé.' });
          this.dialogVisible.set(false);
          this.adminRefresh.notify('products');
        },
        error: (error: Error) => {
          this.handleRequestError(error);
        }
      });
    }
  }

  deleteProduct(product: Product): void {
    this.confirmationService.confirm({
      message: `Supprimer le produit \"${product.name}\" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.productService.deleteProduct(product.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Produit supprimé.' });
            this.adminRefresh.notify('products');
          },
          error: (error: Error) => {
            this.handleRequestError(error);
          }
        });
      }
    });
  }

  toggleProductStatus(product: Product): void {
    this.productService.toggleProductStatus(product.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: `Produit ${product.isActive ? 'activé' : 'désactivé'}`
        });
        this.adminRefresh.notify('products');
      },
      error: (error: Error) => {
        this.handleRequestError(error);
      }
    });
  }

  private handleRequestError(error: Error): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erreur',
      detail: error.message || 'Une erreur est survenue.'
    });

    if (error.message.includes('Session expiree')) {
      void this.router.navigate(['/auth/login']);
    }
  }

  togglePromotion(product: Product): void {
    this.selectedProduct.set(product);
    this.uploadedImages.set(product.images?.length ? [...product.images] : product.image ? [product.image] : []);
    this.productForm.patchValue({
      name: product.name,
      description: product.description ?? '',
      detailedDescription: product.detailedDescription ?? product.description ?? '',
      price: product.price,
      discountPrice: product.discountPrice ?? Math.round(product.price * 0.85),
      category: product.category,
      stock: product.stock,
      isActive: product.isActive,
      isPromotion: true,
      promotionPercentage: product.promotionPercentage ?? 15
    });
    this.specificationSections.set(this.normalizeSpecificationSections(product.specifications));
    this.dialogVisible.set(true);
  }

  openQuickEditor(product: Product): void {
    this.quickEditorProduct.set(product);
    this.quickDetailedDescription.set(product.detailedDescription ?? product.description ?? '');
    this.quickSpecificationSections.set(this.normalizeSpecificationSections(product.specifications));
    this.quickEditorVisible.set(true);
  }

  saveQuickEditor(): void {
    const product = this.quickEditorProduct();

    if (!product) {
      return;
    }

    this.productService
      .updateProduct(product.id, {
        detailedDescription: this.quickDetailedDescription().trim(),
        specifications: this.normalizeSpecificationSections(this.quickSpecificationSections())
      })
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Contenu détaillé mis à jour.' });
          this.quickEditorVisible.set(false);
          this.quickEditorProduct.set(null);
          this.adminRefresh.notify('products');
        },
        error: (error: Error) => {
          this.handleRequestError(error);
        }
      });
  }

  addQuickSpecificationSection(): void {
    this.quickSpecificationSections.update((sections) => [
      ...sections,
      {
        title: '',
        items: ['']
      }
    ]);
  }

  removeQuickSpecificationSection(sectionIndex: number): void {
    this.quickSpecificationSections.update((sections) => sections.filter((_, index) => index !== sectionIndex));
  }

  updateQuickSpecificationSectionTitle(sectionIndex: number, title: string): void {
    this.quickSpecificationSections.update((sections) =>
      sections.map((section, index) => (index === sectionIndex ? { ...section, title } : section))
    );
  }

  addQuickSpecificationItem(sectionIndex: number): void {
    this.quickSpecificationSections.update((sections) =>
      sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: [...section.items, '']
            }
          : section
      )
    );
  }

  updateQuickSpecificationItem(sectionIndex: number, itemIndex: number, value: string): void {
    this.quickSpecificationSections.update((sections) =>
      sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              items: section.items.map((item, iIndex) => (iIndex === itemIndex ? value : item))
            }
          : section
      )
    );
  }

  removeQuickSpecificationItem(sectionIndex: number, itemIndex: number): void {
    this.quickSpecificationSections.update((sections) =>
      sections.map((section, sIndex) => {
        if (sIndex !== sectionIndex) {
          return section;
        }

        const nextItems = section.items.filter((_, iIndex) => iIndex !== itemIndex);

        return {
          ...section,
          items: nextItems.length > 0 ? nextItems : ['']
        };
      })
    );
  }

  addSpecificationSection(): void {
    this.specificationSections.update((sections) => [
      ...sections,
      {
        title: '',
        items: ['']
      }
    ]);
  }

  removeSpecificationSection(sectionIndex: number): void {
    this.specificationSections.update((sections) => sections.filter((_, index) => index !== sectionIndex));
  }

  updateSpecificationSectionTitle(sectionIndex: number, title: string): void {
    this.specificationSections.update((sections) =>
      sections.map((section, index) => (index === sectionIndex ? { ...section, title } : section))
    );
  }

  addSpecificationItem(sectionIndex: number): void {
    this.specificationSections.update((sections) =>
      sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: [...section.items, '']
            }
          : section
      )
    );
  }

  updateSpecificationItem(sectionIndex: number, itemIndex: number, value: string): void {
    this.specificationSections.update((sections) =>
      sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              items: section.items.map((item, iIndex) => (iIndex === itemIndex ? value : item))
            }
          : section
      )
    );
  }

  removeSpecificationItem(sectionIndex: number, itemIndex: number): void {
    this.specificationSections.update((sections) =>
      sections.map((section, sIndex) => {
        if (sIndex !== sectionIndex) {
          return section;
        }

        const nextItems = section.items.filter((_, iIndex) => iIndex !== itemIndex);

        return {
          ...section,
          items: nextItems.length > 0 ? nextItems : ['']
        };
      })
    );
  }

  private normalizeSpecificationSections(
    sections: ProductSpecificationSection[] | null | undefined
  ): ProductSpecificationSection[] {
    if (!Array.isArray(sections)) {
      return [];
    }

    return sections
      .map((section) => ({
        title: section.title?.trim() ?? '',
        items: Array.isArray(section.items) ? section.items.map((item) => item.trim()).filter((item) => item.length > 0) : []
      }))
      .filter((section) => section.title.length > 0 && section.items.length > 0);
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

  async onImageUpload(event: any): Promise<void> {
    // Normalize files: some upload controls (or browsers) provide a FileList (no slice),
    // others provide a plain Array. Convert to a true Array first.
    const rawFiles = event?.files ?? [];
    const filesArray: File[] = Array.isArray(rawFiles) ? rawFiles : Array.from(rawFiles as FileList);

    const currentImagesCount = this.uploadedImages().length;
    const remainingSlots = this.maxImageCount - currentImagesCount;

    if (remainingSlots <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Limite atteinte',
        detail: `Maximum ${this.maxImageCount} images par produit.`
      });

      return;
    }

    const selectedFiles = filesArray.slice(0, remainingSlots);

    if (filesArray.length > selectedFiles.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Images en exces',
        detail: `Seules ${remainingSlots} image(s) ont ete prises en compte.`
      });
    }

    // Align frontend limit with backend policy to avoid rejected uploads.
    const allowedMax = Math.min(this.maxSourceFileSize, this.backendMaxSourceFileSize);

    const validFiles = selectedFiles.filter((file) => file.size <= allowedMax);

    if (validFiles.length < selectedFiles.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fichier trop lourd',
        detail: `Chaque image doit faire moins de ${Math.round(allowedMax / 1024 / 1024 * 100) / 100} MB.`
      });
    }

    const compressedImages = await Promise.all(validFiles.map((file) => this.compressImage(file)));

    this.uploadedImages.update((images) => [...images, ...compressedImages.filter((image): image is string => Boolean(image))]);

    if (compressedImages.some((image) => image === null)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Image ignoree',
        detail: 'Une ou plusieurs images n\'ont pas pu etre traitees.'
      });
    }
  }

  private compressImage(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        const source = reader.result;

        if (typeof source !== 'string') {
          resolve(null);
          return;
        }

        const image = new Image();

        image.onload = () => {
          const ratio = image.width > this.maxImageWidth ? this.maxImageWidth / image.width : 1;
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');

          if (!context) {
            resolve(source);
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', this.imageQuality));
        };

        image.onerror = () => resolve(null);
        image.src = source;
      };

      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
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
