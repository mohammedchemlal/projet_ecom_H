import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import { User } from '../../shared/models/user.model';

interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
}

type RegisterPayload = Pick<User, 'email' | 'password' | 'fullName' | 'phone'> & {
  address?: string;
};

type AdminUserPayload = Pick<User, 'email' | 'fullName' | 'phone' | 'role'> & {
  address?: string;
  password?: string;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private users: User[] = [];

  constructor() {
    this.loadUsers();
    this.loadCurrentUser();
  }

  private loadUsers(): void {
    if (!this.isBrowser) {
      this.users = [];
      return;
    }

    const savedUsers = localStorage.getItem('users');

    if (savedUsers) {
      this.users = JSON.parse(savedUsers) as User[];
      return;
    }

    this.users = [
      {
        id: 1,
        email: 'admin@luxeaccessories.com',
        password: 'Admin@123',
        fullName: 'Admin User',
        address: '',
        phone: '+33123456789',
        role: 'admin',
        createdAt: new Date()
      }
    ];

    this.saveUsers();
  }

  private saveUsers(): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem('users', JSON.stringify(this.users));
  }

  private loadCurrentUser(): void {
    if (!this.isBrowser) {
      return;
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const userData = localStorage.getItem('currentUser');

    if (token && userData) {
      this.currentUserSubject.next(JSON.parse(userData) as User);
    }
  }

  login(email: string, password: string, rememberMe = false): Observable<LoginResponse> {
    return of(null).pipe(
      delay(1000),
      map(() => {
        const user = this.users.find((u) => u.email === email && u.password === password);

        if (!user) {
          throw new Error('Email ou mot de passe incorrect');
        }

        const { password: _ignoredPassword, ...userWithoutPassword } = user;
        const token = btoa(`${user.id}:${Date.now()}`);

        if (this.isBrowser) {
          if (rememberMe) {
            localStorage.setItem('authToken', token);
            sessionStorage.removeItem('authToken');
          } else {
            sessionStorage.setItem('authToken', token);
            localStorage.removeItem('authToken');
          }

          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        }

        this.currentUserSubject.next(userWithoutPassword as User);

        return {
          success: true,
          user: userWithoutPassword as User,
          token
        };
      })
    );
  }

  register(userData: RegisterPayload): Observable<User> {
    const existingUser = this.users.find((u) => u.email === userData.email);

    if (existingUser) {
      return throwError(() => new Error('Cet email est déjà utilisé'));
    }

    const newUser: User = {
      id: Date.now(),
      email: userData.email,
      password: userData.password,
      fullName: userData.fullName,
      address: userData.address ?? '',
      phone: userData.phone,
      role: 'user',
      createdAt: new Date()
    };

    this.users.push(newUser);
    this.saveUsers();

    const { password: _ignoredPassword, ...userWithoutPassword } = newUser;
    const token = btoa(`${newUser.id}:${Date.now()}`);

    if (this.isBrowser) {
      localStorage.setItem('authToken', token);
      sessionStorage.removeItem('authToken');
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
    }

    this.currentUserSubject.next(userWithoutPassword as User);
    return of(userWithoutPassword as User).pipe(delay(500));
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    }

    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    if (!this.isBrowser) {
      return this.currentUserSubject.value !== null;
    }

    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return !!token && this.currentUserSubject.value !== null;
  }

  isAdmin(): boolean {
    return this.currentUserSubject.value?.role === 'admin';
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAllUsers(): Observable<User[]> {
    return of([...this.users]);
  }

  createUser(userData: AdminUserPayload): Observable<User> {
    const emailExists = this.users.some((user) => user.email.toLowerCase() === userData.email.toLowerCase());

    if (emailExists) {
      return throwError(() => new Error('Cet email est deja utilise'));
    }

    const newUser: User = {
      id: Date.now(),
      email: userData.email,
      password: userData.password ?? 'Temp@123',
      fullName: userData.fullName,
      address: userData.address ?? '',
      phone: userData.phone,
      role: userData.role,
      createdAt: new Date()
    };

    this.users = [newUser, ...this.users];
    this.saveUsers();

    return of(newUser).pipe(delay(300));
  }

  updateUser(userId: number, userData: Partial<AdminUserPayload>): Observable<User> {
    const userIndex = this.users.findIndex((user) => user.id === userId);

    if (userIndex === -1) {
      return throwError(() => new Error('Utilisateur introuvable'));
    }

    if (userData.email) {
      const emailExists = this.users.some(
        (user) => user.id !== userId && user.email.toLowerCase() === userData.email!.toLowerCase()
      );

      if (emailExists) {
        return throwError(() => new Error('Cet email est deja utilise'));
      }
    }

    const updatedUser: User = {
      ...this.users[userIndex],
      ...userData,
      address: userData.address ?? this.users[userIndex].address
    };

    this.users[userIndex] = updatedUser;
    this.saveUsers();

    const currentUser = this.currentUserSubject.value;

    if (currentUser?.id === userId) {
      const nextCurrentUser = { ...currentUser, ...updatedUser } as User;

      if (this.isBrowser) {
        localStorage.setItem('currentUser', JSON.stringify(nextCurrentUser));
      }

      this.currentUserSubject.next(nextCurrentUser);
    }

    return of(updatedUser).pipe(delay(300));
  }

  deleteUser(userId: number): Observable<void> {
    const userToDelete = this.users.find((user) => user.id === userId);

    if (!userToDelete) {
      return throwError(() => new Error('Utilisateur introuvable'));
    }

    this.users = this.users.filter((user) => user.id !== userId);
    this.saveUsers();

    const currentUser = this.currentUserSubject.value;

    if (currentUser?.id === userId) {
      this.logout();
    }

    return of(void 0).pipe(delay(300));
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    const currentUser = this.getCurrentUser();

    if (!currentUser) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }

    const userIndex = this.users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...userData };
      this.saveUsers();

      const updatedUser = { ...currentUser, ...userData } as User;

      if (this.isBrowser) {
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }

      this.currentUserSubject.next(updatedUser);
      return of(updatedUser).pipe(delay(500));
    }

    return throwError(() => new Error('Erreur lors de la mise à jour'));
  }
}
