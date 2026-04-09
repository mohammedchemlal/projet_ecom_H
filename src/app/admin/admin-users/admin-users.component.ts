import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-admin-users',
  imports: [ButtonModule, DialogModule, FormsModule, InputTextModule, ReactiveFormsModule, SelectModule, TableModule, TagModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly userDialog = signal(false);
  readonly isEditing = signal(false);
  readonly selectedUser = signal<User | null>(null);
  readonly totalRecords = signal(0);
  readonly currentPage = signal(1);
  readonly rows = signal(10);
  readonly searchTerm = signal('');
  readonly roleFilter = signal<User['role'] | 'all'>('all');
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly roleOptions: Array<{ label: string; value: User['role'] }> = [
    { label: 'Visiteur', value: 'visitor' },
    { label: 'Administrateur', value: 'admin' }
  ];

  readonly roleFilterOptions: Array<{ label: string; value: User['role'] | 'all' }> = [
    { label: 'Tous les roles', value: 'all' },
    ...this.roleOptions
  ];

  readonly userForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    phone: ['', Validators.required],
    address: [''],
    role: ['visitor' as User['role'], Validators.required]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  loadUsers(): void {
    this.loading.set(true);
    this.authService
      .getAdminUsers({
        page: this.currentPage(),
        perPage: this.rows(),
        search: this.searchTerm(),
        role: this.roleFilter()
      })
      .subscribe({
        next: ({ users, meta }) => {
          this.users.set(users);
          this.totalRecords.set(meta.total);
          this.rows.set(meta.perPage);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.users.set([]);
          this.totalRecords.set(0);
          this.loading.set(false);
          this.handleRequestError(error);
        }
      });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const nextRows = event.rows ?? this.rows();
    const first = event.first ?? 0;
    const nextPage = Math.floor(first / nextRows) + 1;

    this.rows.set(nextRows);
    this.currentPage.set(nextPage);
    this.loadUsers();
  }

  onSearchTermChange(value: string): void {
    this.searchTerm.set(value);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.onSearchTermChange(input?.value.trimStart() ?? '');
    this.currentPage.set(1);
    this.scheduleSearch();
  }

  onRoleFilterChange(value: User['role'] | 'all'): void {
    this.roleFilter.set(value);
    this.currentPage.set(1);
    this.scheduleSearch();
  }

  private scheduleSearch(delayMs = 300): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.loadUsers();
      this.searchDebounceTimer = null;
    }, delayMs);
  }

  resetFilters(): void {
    this.searchTerm.set('');
    this.roleFilter.set('all');
    this.currentPage.set(1);
    this.loadUsers();
  }

  openNew(): void {
    this.isEditing.set(false);
    this.selectedUser.set(null);
    this.userForm.reset({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      address: '',
      role: 'visitor'
    });

    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.userDialog.set(true);
  }

  editUser(user: User): void {
    this.isEditing.set(true);
    this.selectedUser.set(user);
    this.userForm.patchValue({
      fullName: user.fullName,
      email: user.email,
      password: '',
      phone: user.phone,
      address: user.address,
      role: user.role
    });

    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    this.userDialog.set(true);
  }

  deleteUser(user: User): void {
    this.confirmationService.confirm({
      message: `Etes-vous sur de vouloir supprimer l'utilisateur \"${user.fullName}\" ?`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.authService.deleteUser(user.id).subscribe({
          next: () => {
            this.removeUserFromView(user.id);
            this.messageService.add({
              severity: 'success',
              summary: 'Succes',
              detail: 'Utilisateur supprime'
            });
          },
          error: (error: Error) => {
            this.handleRequestError(error);
          }
        });
      }
    });
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const userData = this.userForm.getRawValue();
    const selectedUser = this.selectedUser();

    if (this.isEditing() && selectedUser) {
      const updatePayload = {
        fullName: userData.fullName,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        role: userData.role
      };

      this.authService.updateUser(selectedUser.id, updatePayload).subscribe({
        next: (updatedUser) => {
          this.upsertUserInView(updatedUser);
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Utilisateur modifie'
          });
          this.userDialog.set(false);
        },
        error: (error: Error) => {
          this.handleRequestError(error);
        }
      });

      return;
    }

    this.authService
      .createUser({
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password,
        phone: userData.phone,
        address: userData.address,
        role: userData.role
      })
      .subscribe({
      next: (createdUser) => {
        this.upsertUserInView(createdUser);
        this.messageService.add({
          severity: 'success',
          summary: 'Succes',
          detail: 'Utilisateur cree'
        });
        this.userDialog.set(false);
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
      detail: error.message
    });

    if (error.message.includes('Session expiree')) {
      this.authService.logout();
      void this.router.navigate(['/auth/login']);
    }
  }

  getRoleLabel(role: User['role']): string {
    return role === 'admin' ? 'Administrateur' : 'Visiteur';
  }

  getRoleSeverity(role: User['role']): 'danger' | 'info' {
    return role === 'admin' ? 'danger' : 'info';
  }

  private upsertUserInView(user: User): void {
    const currentUsers = this.users();
    const existingIndex = currentUsers.findIndex((item) => item.id === user.id);

    if (existingIndex >= 0) {
      const updatedUsers = [...currentUsers];
      updatedUsers[existingIndex] = user;
      this.users.set(updatedUsers);
      return;
    }

    this.users.set([user, ...currentUsers].slice(0, this.rows()));
    this.totalRecords.update((total) => total + 1);
  }

  private removeUserFromView(userId: number): void {
    const before = this.users();
    const after = before.filter((item) => item.id !== userId);

    if (after.length === before.length) {
      return;
    }

    this.users.set(after);
    this.totalRecords.update((total) => Math.max(total - 1, 0));

    if (after.length === 0 && this.currentPage() > 1) {
      this.currentPage.update((page) => Math.max(page - 1, 1));
      this.loadUsers();
    }
  }
}
