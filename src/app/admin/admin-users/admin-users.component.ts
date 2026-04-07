import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-admin-users',
  imports: [ButtonModule, DialogModule, InputTextModule, ReactiveFormsModule, SelectModule, TableModule, TagModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly userDialog = signal(false);
  readonly isEditing = signal(false);
  readonly selectedUser = signal<User | null>(null);

  readonly roleOptions: Array<{ label: string; value: User['role'] }> = [
    { label: 'Utilisateur', value: 'user' },
    { label: 'Administrateur', value: 'admin' }
  ];

  readonly userForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    role: ['user' as User['role'], Validators.required]
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.authService.getAllUsers().subscribe((users) => {
      this.users.set(users);
      this.loading.set(false);
    });
  }

  openNew(): void {
    this.isEditing.set(false);
    this.selectedUser.set(null);
    this.userForm.reset({
      fullName: '',
      email: '',
      phone: '',
      address: '',
      role: 'user'
    });
    this.userDialog.set(true);
  }

  editUser(user: User): void {
    this.isEditing.set(true);
    this.selectedUser.set(user);
    this.userForm.patchValue({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role
    });
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
            this.loadUsers();
            this.messageService.add({
              severity: 'success',
              summary: 'Succes',
              detail: 'Utilisateur supprime'
            });
          },
          error: (error: Error) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: error.message
            });
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
      this.authService.updateUser(selectedUser.id, userData).subscribe({
        next: () => {
          this.loadUsers();
          this.messageService.add({
            severity: 'success',
            summary: 'Succes',
            detail: 'Utilisateur modifie'
          });
          this.userDialog.set(false);
        },
        error: (error: Error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: error.message
          });
        }
      });

      return;
    }

    this.authService.createUser(userData).subscribe({
      next: () => {
        this.loadUsers();
        this.messageService.add({
          severity: 'success',
          summary: 'Succes',
          detail: 'Utilisateur cree'
        });
        this.userDialog.set(false);
      },
      error: (error: Error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: error.message
        });
      }
    });
  }

  getRoleLabel(role: User['role']): string {
    return role === 'admin' ? 'Administrateur' : 'Utilisateur';
  }

  getRoleSeverity(role: User['role']): 'danger' | 'info' {
    return role === 'admin' ? 'danger' : 'info';
  }
}
