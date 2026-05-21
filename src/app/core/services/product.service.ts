import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, delay, map, of, tap, throwError } from 'rxjs';
import { OptimisticService } from './optimistic.service';

import type { Product, ProductReview } from '../../shared/models/product.model';
import { environment } from '../../../environments/environment';

interface ApiProductSpecificationSection {
  title: string;
  items: string[];
}

interface ApiProduct {
  id: number;
  name: string;
  description: string | null;
  detailed_description: string | null;
  specifications: ApiProductSpecificationSection[] | null;
  price: number | string;
  discount_price: number | string | null;
  image: string | null;
  images: string[] | null;
  category: string;
  rating: number | string;
  review_count: number;
  stock: number;
  is_active: boolean;
  is_promotion: boolean;
  promotion_percentage: number | null;
  created_at: string;
}

interface ApiProductReview {
  id: number;
  user_id: number | null;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  title: string;
  comment: string;
  likes: number;
  verified: boolean;
  images: string[] | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  private readonly optimistic = inject(OptimisticService);

  // Start with an empty cache to avoid showing embedded mock products when API is unavailable
  private readonly productsSubject = new BehaviorSubject<Product[]>([]);

  readonly products$ = this.productsSubject.asObservable();

  constructor() {
    this.refreshProductsFromApi().subscribe();
  }

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }

  private mapApiProduct(product: ApiProduct): Product {
    const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];
    const fallbackImage = product.image ?? images[0] ?? '';
    const specifications = Array.isArray(product.specifications)
      ? product.specifications
          .filter((section) => section && typeof section.title === 'string' && Array.isArray(section.items))
          .map((section) => ({
            title: section.title,
            items: section.items.filter((item) => typeof item === 'string')
          }))
      : [];

    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      detailedDescription: product.detailed_description ?? product.description ?? '',
      specifications,
      price: Number(product.price),
      discountPrice: product.discount_price !== null ? Number(product.discount_price) : undefined,
      image: fallbackImage,
      images: images.length > 0 ? images : fallbackImage ? [fallbackImage] : [],
      category: product.category,
      rating: Number(product.rating ?? 0),
      reviewCount: product.review_count ?? 0,
      stock: product.stock,
      isActive: Boolean(product.is_active),
      isPromotion: Boolean(product.is_promotion),
      promotionPercentage: product.promotion_percentage ?? undefined,
      createdAt: new Date(product.created_at)
    };
  }

  private mapApiProductReview(review: ApiProductReview): ProductReview {
    return {
      id: review.id,
      userId: review.user_id,
      userName: review.user_name,
      userAvatar: review.user_avatar ?? undefined,
      rating: Number(review.rating),
      title: review.title,
      comment: review.comment,
      date: new Date(review.created_at),
      likes: review.likes ?? 0,
      verified: Boolean(review.verified),
      images: review.images ?? []
    };
  }

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Session expiree. Veuillez vous reconnecter.';
      }

      const apiError = error.error as { message?: string; errors?: Record<string, string[]> } | string | null;

      if (typeof apiError === 'string') {
        return apiError;
      }

      if (apiError?.message) {
        return apiError.message;
      }

      if (apiError?.errors) {
        const firstError = Object.values(apiError.errors)[0]?.[0];
        if (firstError) {
          return firstError;
        }
      }
    }

    return 'Une erreur est survenue';
  }

  private clearAuthSession(): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }

  private refreshProductsFromApi(): Observable<Product[]> {
    if (!this.isBrowser) {
      return of(this.productsSubject.value);
    }

    return this.http.get<ApiProduct[] | { data: ApiProduct[]; total?: number }>(this.apiUrl).pipe(
      map((resp) => {
        const list: ApiProduct[] = Array.isArray(resp) ? resp : resp.data ?? [];
        return list.map((product) => this.mapApiProduct(product));
      }),
      tap((products) => this.productsSubject.next(products)),
      catchError((error) => {
        console.error('Failed to refresh products from API:', error);
        // On API error return an empty list to avoid showing stale/mock data
        this.productsSubject.next([]);
        return of([] as Product[]);
      })
    );
  }

  getProducts(): Observable<Product[]> {
    return this.refreshProductsFromApi();
  }

  getProductById(id: number): Observable<Product | undefined> {
    const cachedProduct = this.productsSubject.value.find((product) => product.id === id);

    if (cachedProduct) {
      return of(cachedProduct);
    }

    return this.http.get<ApiProduct>(`${this.apiUrl}/${id}`).pipe(
      map((product) => {
        const mappedProduct = this.mapApiProduct(product);
        const existing = this.productsSubject.value;
        const alreadyExists = existing.some((item) => item.id === mappedProduct.id);

        this.productsSubject.next(alreadyExists ? existing.map((item) => (item.id === mappedProduct.id ? mappedProduct : item)) : [...existing, mappedProduct]);

        return mappedProduct;
      }),
      catchError((error) => {
        console.error('Error fetching product:', error);
        return of(undefined);
      })
    );
  }

  getProductReviews(productId: number): Observable<ProductReview[]> {
    return this.http.get<ApiProductReview[]>(`${this.apiUrl}/${productId}/reviews`).pipe(
      map((reviews) => reviews.map((review) => this.mapApiProductReview(review))),
      catchError(() => of([]))
    );
  }

  updateProductReview(
    productId: number,
    reviewId: number,
    payload: {
      rating?: number;
      title?: string;
      comment?: string;
    }
  ): Observable<ProductReview> {
    return this.http
      .patch<ApiProductReview>(
        `${this.apiUrl}/${productId}/reviews/${reviewId}`,
        payload,
        { headers: this.authHeaders }
      )
      .pipe(
        map((review) => this.mapApiProductReview(review)),
        catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
      );
  }

  deleteProductReview(productId: number, reviewId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${productId}/reviews/${reviewId}`, { headers: this.authHeaders })
      .pipe(
        catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
      );
  }

  submitProductReview(
    productId: number,
    payload: {
      rating: number;
      title: string;
      comment: string;
    }
  ): Observable<ProductReview> {
    return this.http
      .post<ApiProductReview>(
        `${this.apiUrl}/${productId}/reviews`,
        {
          rating: payload.rating,
          title: payload.title,
          comment: payload.comment
        },
        {
          headers: this.authHeaders
        }
      )
      .pipe(
        map((review) => this.mapApiProductReview(review)),
        catchError((error) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            return throwError(() => new Error('Veuillez vous connecter pour publier un avis.'));
          }

          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  getProductsWithFilters(filters?: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    perPage?: number;
    sort?: string;
    isPromotion?: boolean;
  }): Observable<{ products: Product[]; total: number }> {
    if (!this.isBrowser) {
      return of({ products: this.productsSubject.value, total: this.productsSubject.value.length });
    }

    let params = new HttpParams();
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.minPrice !== undefined) params = params.set('min_price', filters.minPrice.toString());
    if (filters?.maxPrice !== undefined) params = params.set('max_price', filters.maxPrice.toString());
    if (filters?.page) params = params.set('page', filters.page.toString());
    if (filters?.perPage) params = params.set('per_page', filters.perPage.toString());
    if (filters?.sort) params = params.set('sort', filters.sort);
    if (filters?.isPromotion) params = params.set('is_promotion', '1');

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((resp) => {
        const list: ApiProduct[] = Array.isArray(resp) ? resp : resp.data ?? [];
        const mapped = list.map((product) => this.mapApiProduct(product));
        const total = !Array.isArray(resp) && typeof resp.total === 'number' ? resp.total : mapped.length;
        // update cache with current page results
        this.productsSubject.next(mapped);
        return { products: mapped, total };
      }),
      catchError(() => of({ products: this.productsSubject.value, total: this.productsSubject.value.length }))
    );
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.products$.pipe(map((products) => products.slice(0, 4)));
  }

  getProductsByCategory(category: string): Observable<Product[]> {
    return this.products$.pipe(map((products) => products.filter((product) => product.category === category)));
  }

  getLowStockProducts(threshold = 10): Observable<Product[]> {
    return this.products$.pipe(map((products) => products.filter((product) => product.stock <= threshold)));
  }

  searchProducts(query: string): Observable<Product[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.getProducts();
    }

    return this.products$.pipe(
      map((products) =>
        products.filter((product) => {
          const nameMatches = product.name.toLowerCase().includes(normalizedQuery);
          const descriptionMatches = (product.description ?? '').toLowerCase().includes(normalizedQuery);

          return nameMatches || descriptionMatches;
        })
      )
    );
  }

  addProduct(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const products = this.productsSubject.value;
    const nextId = Math.max(...products.map((item) => item.id), 0) + 1;
    const createdProduct: Product = {
      ...product,
      id: nextId,
      createdAt: new Date()
    };

    this.productsSubject.next([...products, createdProduct]);
    return createdProduct;
  }

  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Observable<Product> {
    const payload = {
      name: product.name,
      description: product.description ?? '',
      detailed_description: product.detailedDescription ?? product.description ?? '',
      specifications: product.specifications ?? null,
      price: product.price,
      discount_price: product.discountPrice ?? null,
      image: product.image ?? product.images[0] ?? null,
      images: product.images,
      category: product.category,
      rating: product.rating,
      review_count: product.reviewCount,
      stock: product.stock,
      is_active: product.isActive,
      is_promotion: Boolean(product.isPromotion),
      promotion_percentage: product.promotionPercentage ?? null
    };

    // optimistic flow: create a temporary product locally and replace when API returns
    const tempId = -Math.floor(Date.now() / 1000);
    const tempProduct: Product = { ...product, id: tempId, createdAt: new Date() } as Product;

    const api$ = this.http.post<ApiProduct>(this.apiUrl, payload, { headers: this.authHeaders }).pipe(
      map((created) => this.mapApiProduct(created))
    );

    return this.optimistic.optimisticCreate(this.productsSubject, tempProduct, api$).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearAuthSession();
        }

        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        // fallback: keep temp product
        return of(tempProduct).pipe(delay(0));
      })
    );
  }

  updateProduct(id: number, updates: Partial<Product>): Observable<Product | undefined> {
    const payload = {
      name: updates.name,
      description: updates.description,
      detailed_description: updates.detailedDescription,
      specifications: updates.specifications,
      price: updates.price,
      discount_price: updates.discountPrice,
      image: updates.image,
      images: updates.images,
      category: updates.category,
      rating: updates.rating,
      review_count: updates.reviewCount,
      stock: updates.stock,
      is_active: updates.isActive,
      is_promotion: updates.isPromotion,
      promotion_percentage: updates.promotionPercentage
    };

    return this.http.patch<ApiProduct>(`${this.apiUrl}/${id}`, payload, { headers: this.authHeaders }).pipe(
      map((updated) => {
        const mapped = this.mapApiProduct(updated);
        this.productsSubject.next(this.productsSubject.value.map((product) => (product.id === id ? mapped : product)));
        return mapped;
      }),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearAuthSession();
        }

        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        let updatedProduct: Product | undefined;

        this.productsSubject.next(
          this.productsSubject.value.map((product) => {
            if (product.id !== id) {
              return product;
            }

            updatedProduct = {
              ...product,
              ...updates
            };

            return updatedProduct;
          })
        );

        return of(updatedProduct).pipe(delay(0));
      })
    );
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders }).pipe(
      tap(() => this.productsSubject.next(this.productsSubject.value.filter((product) => product.id !== id))),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearAuthSession();
        }

        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        this.productsSubject.next(this.productsSubject.value.filter((product) => product.id !== id));
        return of(void 0).pipe(delay(0));
      })
    );
  }

  toggleProductStatus(id: number): Observable<Product | undefined> {
    const product = this.productsSubject.value.find((item) => item.id === id);

    if (!product) {
      return of(undefined);
    }

    return this.updateProduct(id, { isActive: !product.isActive });
  }
}
