import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface CategoryOption {
  id: number;
  label: string;
  value: string;
  icon: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
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

  getCategories(): Observable<CategoryOption[]> {
    return this.categories$;
  }

  createCategory(category: Omit<CategoryOption, 'id'>): Observable<CategoryOption> {
    const newCategory: CategoryOption = {
      ...category,
      id: Date.now()
    };

    this.categoriesSubject.next([...this.categoriesSubject.value, newCategory]);
    return of(newCategory);
  }

  updateCategory(id: number, category: Partial<Omit<CategoryOption, 'id'>>): Observable<CategoryOption> {
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
      throw new Error('Categorie introuvable.');
    }

    return of(updatedCategory);
  }

  deleteCategory(id: number): Observable<{ success: true }> {
    this.categoriesSubject.next(this.categoriesSubject.value.filter((item) => item.id !== id));
    return of({ success: true });
  }
}