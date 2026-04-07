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
import { Product } from '../../shared/models/product.model';

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
  categories = [
    { label: 'Colliers', value: 'necklaces', icon: 'pi-gem', count: 0 },
    { label: 'Bagues', value: 'rings', icon: 'pi-circle', count: 0 },
    { label: 'Bracelets', value: 'bracelets', icon: 'pi-link', count: 0 },
    { label: 'Boucles d\'oreilles', value: 'earrings', icon: 'pi-star', count: 0 }
  ];
  
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
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setupSearchDebounce() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  loadProducts() {
    this.isLoading = true;
    this.productService.getProducts().subscribe(products => {
      this.products = products;
      this.maxPrice = Math.max(...products.map(p => p.price));
      this.priceRange = [0, this.maxPrice];
      this.updateCategoryCounts();
      this.applyFilters();
      this.isLoading = false;
    });
  }

  updateCategoryCounts() {
    this.categories.forEach(category => {
      category.count = this.products.filter(p => p.category === category.value).length;
    });
  }

  applyFilters() {
    let filtered = [...this.products];
    
    // Category filter
    if (this.selectedCategories.length > 0) {
      filtered = filtered.filter(p => this.selectedCategories.includes(p.category));
    }
    
    // Price filter
    filtered = filtered.filter(p => 
      (p.discountPrice || p.price) >= this.priceRange[0] && 
      (p.discountPrice || p.price) <= this.priceRange[1]
    );
    
    // Promotions only
    if (this.showPromotionsOnly) {
      filtered = filtered.filter(p => p.isPromotion);
    }
    
    // Search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.description ?? '').toLowerCase().includes(query)
      );
    }
    
    // Sorting
    filtered = this.sortProducts(filtered);
    
    this.totalProducts = filtered.length;
    this.filteredProducts = this.paginateProducts(filtered);
  }

  sortProducts(products: Product[]): Product[] {
    switch (this.sortBy) {
      case 'price_asc':
        return products.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
      case 'price_desc':
        return products.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
      case 'rating':
        return products.sort((a, b) => b.rating - a.rating);
      case 'popular':
        return products.sort((a, b) => b.reviewCount - a.reviewCount);
      case 'newest':
      default:
        return products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  paginateProducts(products: Product[]): Product[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return products.slice(start, start + this.itemsPerPage);
  }

  onPageChange(event: any) {
    this.currentPage = event.page + 1;
    this.applyFilters();
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