import { inject } from '@angular/core';
import { RenderMode, ServerRoute } from '@angular/ssr';
import { firstValueFrom } from 'rxjs';

import { ProductService } from './core/services/product.service';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'home',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'products',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'product/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const productService = inject(ProductService);
      const products = await firstValueFrom(productService.getProducts());

      return products.map((product) => ({ id: String(product.id) }));
    }
  },
  {
    path: 'cart',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'checkout',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'wishlist',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'profile',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'auth/login',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin/products',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin/orders',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin/users',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin/categories',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'admin/promo-codes',
    renderMode: RenderMode.Prerender
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
