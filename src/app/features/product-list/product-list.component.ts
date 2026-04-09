import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { PaginatorModule } from 'primeng/paginator';
import { RatingModule } from 'primeng/rating';
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { CategoryService } from '../../core/services/category.service';
import { Product } from '../../shared/models/product.model';

interface ProductFilterCategory {
  label: string;
  value: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-product-list',
  imports: [
    ButtonModule,
    CommonModule,
    CurrencyPipe,
    DrawerModule,
    FormsModule,
    PaginatorModule,
    RatingModule,
    RouterLink,
    SelectModule,
    SliderModule
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  isLoading = true;
  sidebarVisible = false;
  
  // Filters
  selectedCategories: string[] = [];
  priceRange: number[] = [0, 1000];
  maxPrice = 1000;
  showPromotionsOnly = false;
  searchQuery = '';
  sortBy = 'newest';
  
  // Categories
  categories: ProductFilterCategory[] = [];

  visibleCategories(): ProductFilterCategory[] {
    return this.categories.filter(
      (category) => category.count > 0 || this.selectedCategories.includes(category.value)
    );
  }
  
  // Sort options
  sortOptions = [
    { label: 'Plus récents', value: 'newest' },
    { label: 'Prix croissant', value: 'price_asc' },
    { label: 'Prix décroissant', value: 'price_desc' },
    { label: 'Meilleures notes', value: 'rating' },
    { label: 'Plus populaires', value: 'popular' }
  ];
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 12;
  totalProducts = 0;
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadProducts();
    this.setupSearchDebounce();
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategories = [params['category']];
        this.applyFilters();
      }
      if (params['search']) {
        this.searchQuery = params['search'];
        this.applyFilters();
      }
    });
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe((categories) => {
      this.categories = categories.map((category) => ({
        label: category.label,
        value: category.value,
        icon: this.normalizeIcon(category.icon),
        count: this.products.filter((p) => p.category === category.value).length
      }));

      this.updateCategoryCounts();
    });
  }

  private normalizeIcon(rawIcon: string | undefined): string {
    if (!rawIcon) {
      return 'pi-tag';
    }

    const token = rawIcon
      .split(/\s+/)
      .find((part) => part.startsWith('pi-'));

    return token ?? 'pi-tag';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearchDebounce() {
    this.searchSubject.pipe(
      debounceTime(300), // Réduit de 500ms à 300ms pour une réactivité plus rapide
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  loadProducts() {
    this.isLoading = true;
    
    // Build filter parameters for backend
    // Note: page and perPage are handled client-side after filtering
    const filters: any = {
      category: this.selectedCategories.length === 1 ? this.selectedCategories[0] : undefined,
      search: this.searchQuery.trim() ? this.searchQuery : undefined,
      minPrice: this.priceRange[0] > 0 ? this.priceRange[0] : undefined,
      maxPrice: this.priceRange[1] < this.maxPrice ? this.priceRange[1] : undefined,
      sort: this.sortBy
    };

    // Add is_promotion filter if selected
    if (this.showPromotionsOnly) {
      filters.isPromotion = true;
    }

    this.productService.getProductsWithFilters(filters).subscribe(products => {
      this.products = products;
      if (products.length > 0) {
        const allPrices = products.map(p => p.discountPrice || p.price);
        this.maxPrice = Math.max(...allPrices);
      }
      this.updateCategoryCounts();
      this.totalProducts = this.products.length;
      // Apply client-side pagination
      this.filteredProducts = this.paginateProducts(this.products);
      this.isLoading = false;
    });
  }

  updateCategoryCounts() {
    if (this.categories.length === 0) {
      return;
    }

    this.categories.forEach(category => {
      category.count = this.products.filter(p => p.category === category.value).length;
    });
  }

  applyFilters() {
    this.currentPage = 1; // Reset to first page on filter change
    this.loadProducts();
  }

  sortProducts(products: Product[]): Product[] {
    // Products are already sorted by backend via the 'sort' parameter
    // This method is kept for backward compatibility but does not re-sort
    return products;
  }

  paginateProducts(products: Product[]): Product[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return products.slice(start, start + this.itemsPerPage);
  }

  onPageChange(event: any) {
    this.currentPage = event.page + 1;
    this.loadProducts(); // Load with the new page number directly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
  }

  clearFilters() {
    this.selectedCategories = [];
    this.priceRange = [0, this.maxPrice];
    this.showPromotionsOnly = false;
    this.searchQuery = '';
    this.sortBy = 'newest';
    this.currentPage = 1;
    this.applyFilters();
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product, 1);
  }

  addToWishlist(product: Product) {
    this.wishlistService.addToWishlist(product);
  }

  isInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  getDiscountedPrice(product: Product): number {
    return product.discountPrice || product.price;
  }

  getDiscountPercentage(product: Product): number {
    if (!product.discountPrice) return 0;
    return Math.round(((product.price - product.discountPrice) / product.price) * 100);
  }

  toggleCategory(categoryValue: string) {
    const index = this.selectedCategories.indexOf(categoryValue);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(categoryValue);
    }
    this.currentPage = 1;
    this.applyFilters();
  }

  onPriceRangeChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  togglePromotionsFilter() {
    this.showPromotionsOnly = !this.showPromotionsOnly;
    this.currentPage = 1;
    this.applyFilters();
  }

  resetPriceFilter() {
    this.priceRange = [0, this.maxPrice];
    this.currentPage = 1;
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return this.selectedCategories.length > 0 ||
           this.priceRange[0] > 0 ||
           this.priceRange[1] < this.maxPrice ||
           this.showPromotionsOnly ||
           this.searchQuery.trim() !== '';
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.selectedCategories.length > 0) count++;
    if (this.priceRange[0] > 0 || this.priceRange[1] < this.maxPrice) count++;
    if (this.showPromotionsOnly) count++;
    if (this.searchQuery.trim()) count++;
    return count;
  }

  getCategoryLabel(categoryValue: string): string {
    return this.categories.find((category) => category.value === categoryValue)?.label ?? categoryValue;
  }
}