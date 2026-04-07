import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, map, of } from 'rxjs';

import type { Product } from '../../shared/models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly productsSubject = new BehaviorSubject<Product[]>([
    {
      id: 1,
      name: 'Collier Élégance Dorée',
      description: 'Superbe collier en or 18 carats avec pendentif en diamant. Parfait pour les occasions spéciales.',
      price: 299.99,
      discountPrice: 199.99,
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
      images: [
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600',
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600'
      ],
      category: 'necklaces',
      rating: 4.8,
      reviewCount: 124,
      stock: 15,
      isActive: true,
      isPromotion: true,
      promotionPercentage: 33,
      createdAt: new Date()
    },
    {
      id: 2,
      name: 'Bague Solitaire Argent',
      description: 'Bague en argent sterling avec pierre précieuse. Design élégant et intemporel.',
      price: 149.99,
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
      images: [
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
        'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600'
      ],
      category: 'rings',
      rating: 4.9,
      reviewCount: 89,
      stock: 23,
      isActive: true,
      isPromotion: false,
      createdAt: new Date()
    },
    {
      id: 3,
      name: 'Bracelet Chaîne Or Rose',
      description: 'Bracelet fin en or rose avec fermoir sécurité. Idéal pour un usage quotidien.',
      price: 89.99,
      discountPrice: 71.99,
      image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
      images: [
        'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
        'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600'
      ],
      category: 'bracelets',
      rating: 4.7,
      reviewCount: 56,
      stock: 30,
      isActive: true,
      isPromotion: true,
      promotionPercentage: 20,
      createdAt: new Date()
    },
    {
      id: 5,
      name: 'Collier Cœur Éternel',
      description: 'Collier avec pendentif coeur en or blanc. Cadeau parfait pour la Saint-Valentin.',
      price: 199.99,
      discountPrice: 159.99,
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
      images: [
        'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600'
      ],
      category: 'necklaces',
      rating: 4.9,
      reviewCount: 234,
      stock: 12,
      isActive: true,
      isPromotion: true,
      promotionPercentage: 20,
      createdAt: new Date()
    },
    {
      id: 6,
      name: 'Bague Fiançailles Solitaire',
      description: 'Magnifique bague de fiançailles avec diamant certifié.',
      price: 599.99,
      image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
      images: [
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
        'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600'
      ],
      category: 'rings',
      rating: 5,
      reviewCount: 67,
      stock: 5,
      isActive: true,
      isPromotion: false,
      createdAt: new Date()
    },
    {
      id: 7,
      name: 'Bracelet Charms Personnalisable',
      description: 'Bracelet avec charms amovibles. Personnalisez-le selon vos envies.',
      price: 129.99,
      discountPrice: 103.99,
      image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
      images: [
        'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=600',
        'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600'
      ],
      category: 'bracelets',
      rating: 4.8,
      reviewCount: 145,
      stock: 20,
      isActive: true,
      isPromotion: true,
      promotionPercentage: 20,
      createdAt: new Date()
    }
  ]);

  readonly products$ = this.productsSubject.asObservable();

  getProducts(): Observable<Product[]> {
    return this.products$;
  }

  getProductById(id: number): Observable<Product | undefined> {
    return this.products$.pipe(map((products) => products.find((product) => product.id === id)));
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
    return of(this.addProduct(product)).pipe(delay(0));
  }

  updateProduct(id: number, updates: Partial<Product>): Observable<Product | undefined> {
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
  }

  deleteProduct(id: number): Observable<void> {
    this.productsSubject.next(this.productsSubject.value.filter((product) => product.id !== id));
    return of(void 0).pipe(delay(0));
  }

  toggleProductStatus(id: number): Observable<Product | undefined> {
    let updatedProduct: Product | undefined;

    this.productsSubject.next(
      this.productsSubject.value.map((product) => {
        if (product.id !== id) {
          return product;
        }

        updatedProduct = {
          ...product,
          isActive: !product.isActive
        };

        return updatedProduct;
      })
    );

    return of(updatedProduct).pipe(delay(0));
  }
}
