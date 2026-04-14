import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { HomeComponent } from './features/home';

const loadHomeComponent = () => Promise.resolve(HomeComponent);

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: loadHomeComponent,
		data: {
			title: 'Valerya — Accueil',
			description: 'Bijoux artisanaux et collections élégantes — découvrez nos nouveautés.'
		}
	},
	{
		path: 'home',
		loadComponent: loadHomeComponent,
		data: {
			title: 'Valerya — Accueil',
			description: 'Bijoux artisanaux et collections élégantes — découvrez nos nouveautés.'
		}
	},
	{
		path: 'products',
		loadComponent: () => import('./features/product-list/product-list.component').then((m) => m.ProductListComponent),
		data: {
			title: 'Produits — Valerya',
			description: 'Parcourez notre catalogue de bijoux : colliers, bracelets, bagues et boucles d\'oreilles.'
		}
	},
	{
		path: 'product/:id',
		loadComponent: () => import('./features/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
		data: {
			title: 'Produit — Valerya',
			description: 'Détails du produit, prix, avis et options d\'achat.'
		}
	},
	{
		path: 'cart',
		loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent)
	},
	{
		path: 'checkout',
		canActivate: [authGuard],
		loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent)
	},
	{
		path: 'wishlist',
		canActivate: [authGuard],
		loadComponent: () => import('./features/wishlist/wishlist.component').then((m) => m.WishlistComponent)
	},
	{
		path: 'profile',
		canActivate: [authGuard],
		loadComponent: () => import('./features/user-profile/user-profile.component').then((m) => m.UserProfileComponent)
	},
	{
		path: 'auth',
		loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'login'
			},
			{
				path: 'login',
				loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
			},
			{
				path: 'register',
				loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
			}
		]
	},
	{
		path: 'admin',
		canActivate: [adminGuard],
		loadChildren: () => import('./admin/admin.module').then((m) => m.AdminModule)
	}
];
