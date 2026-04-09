import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';

interface ApiCategory {
  id: number;
  label: string;
  value: string;
  icon: string;
  description: string;
}

export interface CategoryOption {
  id: number;
  label: string;
  value: string;
  icon: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  private readonly categoriesSubject = new BehaviorSubject<CategoryOption[]>([
    {
      id: 1,
      label: 'Colliers',
      value: 'necklaces',
      icon: 'pi pi-gem',
      description: 'Colliers elegants'
    },
    {
      id: 2,
      label: 'Bagues',
      value: 'rings',
      icon: 'pi pi-circle',
      description: 'Bagues raffinees'
    },
    {
      id: 3,
      label: 'Bracelets',
      value: 'bracelets',
      icon: 'pi pi-link',
      description: 'Bracelets tendance'
    },
    {
      id: 4,
      label: "Boucles d'oreilles",
      value: 'earrings',
      icon: 'pi pi-star',
      description: "Boucles d'oreilles"
    }
  ]);

  readonly categories$ = this.categoriesSubject.asObservable();

  constructor() {
    this.refreshCategoriesFromApi().subscribe();
  }

  private get authHeaders(): HttpHeaders {
    if (!this.isBrowser) {
      return new HttpHeaders();
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }

  private getApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiError = error.error as { message?: string; errors?: Record<string, string[]> } | string | null;

      if (typeof apiError === 'string') {
        return apiError;
      }

      if (apiError?.message) {
        return apiError.message;
      }
    }

    return 'Une erreur est survenue';
  }

  private refreshCategoriesFromApi(): Observable<CategoryOption[]> {
    if (!this.isBrowser) {
      return of(this.categoriesSubject.value);
    }

    return this.http.get<ApiCategory[]>(this.apiUrl).pipe(
      map((categories) =>
        categories.map((category) => ({
          id: category.id,
          label: category.label,
          value: category.value,
          icon: category.icon,
          description: category.description
        }))
      ),
      tap((categories) => this.categoriesSubject.next(categories)),
      catchError(() => of(this.categoriesSubject.value))
    );
  }

  getCategories(): Observable<CategoryOption[]> {
    return this.refreshCategoriesFromApi();
  }

  createCategory(category: Omit<CategoryOption, 'id'>): Observable<CategoryOption> {
    return this.http.post<ApiCategory>(this.apiUrl, category, { headers: this.authHeaders }).pipe(
      map((created) => ({
        id: created.id,
        label: created.label,
        value: created.value,
        icon: created.icon,
        description: created.description
      })),
      tap((created) => this.categoriesSubject.next([...this.categoriesSubject.value, created])),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        const newCategory: CategoryOption = {
          ...category,
          id: Date.now()
        };

        this.categoriesSubject.next([...this.categoriesSubject.value, newCategory]);
        return of(newCategory);
      })
    );
  }

  updateCategory(id: number, category: Partial<Omit<CategoryOption, 'id'>>): Observable<CategoryOption> {
    return this.http.patch<ApiCategory>(`${this.apiUrl}/${id}`, category, { headers: this.authHeaders }).pipe(
      map((updated) => ({
        id: updated.id,
        label: updated.label,
        value: updated.value,
        icon: updated.icon,
        description: updated.description
      })),
      tap((updatedCategory) =>
        this.categoriesSubject.next(
          this.categoriesSubject.value.map((item) => (item.id === id ? updatedCategory : item))
        )
      ),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        let updatedCategory: CategoryOption | undefined;

        this.categoriesSubject.next(
          this.categoriesSubject.value.map((item) => {
            if (item.id !== id) {
              return item;
            }

            updatedCategory = {
              ...item,
              ...category
            };

            return updatedCategory;
          })
        );

        if (!updatedCategory) {
          return throwError(() => new Error('Categorie introuvable.'));
        }

        return of(updatedCategory);
      })
    );
  }

  deleteCategory(id: number): Observable<{ success: true }> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders }).pipe(
      tap(() => this.categoriesSubject.next(this.categoriesSubject.value.filter((item) => item.id !== id))),
      map(() => ({ success: true as const })),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status !== 404) {
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        }

        this.categoriesSubject.next(this.categoriesSubject.value.filter((item) => item.id !== id));
        return of({ success: true as const });
      })
    );
  }
}