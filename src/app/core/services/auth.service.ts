import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, delay, map, of, throwError } from 'rxjs';

import { User } from '../../shared/models/user.model';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
}

interface ApiUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  role: User['role'];
  created_at: string;
}

interface ApiAuthResponse {
  message: string;
  user: ApiUser;
  token: string;
}

type RegisterPayload = Pick<User, 'email' | 'password' | 'fullName' | 'phone'> & {
  confirmPassword?: string;
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
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiBaseUrl = `${environment.apiUrl}/auth`;

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
        email: 'admin@valeriahouse.com',
        password: 'Admin@123',
        fullName: 'Admin ValeriaHouse',
        address: 'Paris, France',
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

    const token = this.getStoredToken();
    const userData = localStorage.getItem('currentUser');

    if (token && userData) {
      this.currentUserSubject.next(JSON.parse(userData) as User);
    }
  }

  login(email: string, password: string, rememberMe = false): Observable<LoginResponse> {
    return this.http.post<ApiAuthResponse>(`${this.apiBaseUrl}/login`, { email, password }).pipe(
      map((response) => {
        const user = this.mapApiUser(response.user);
        this.storeSession(user, response.token, rememberMe);

        return {
          success: true,
          user,
          token: response.token
        };
      }),
      catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
    );
  }

  register(userData: RegisterPayload): Observable<User> {
    const payload = {
      full_name: userData.fullName,
      email: userData.email,
      password: userData.password,
      password_confirmation: userData.confirmPassword ?? userData.password,
      phone: userData.phone,
      address: userData.address ?? ''
    };

    return this.http.post<ApiAuthResponse>(`${this.apiBaseUrl}/register`, payload).pipe(
      map((response) => {
        const user = this.mapApiUser(response.user);
        this.storeSession(user, response.token, true);
        return user;
      }),
      catchError((error) => throwError(() => new Error(this.getApiErrorMessage(error))))
    );
  }

  logout(): void {
    const token = this.getStoredToken();

    if (this.isBrowser && token) {
      this.http
        .post(
          `${this.apiBaseUrl}/logout`,
          {},
          {
            headers: this.buildAuthHeaders(token)
          }
        )
        .subscribe({ error: () => void 0 });
    }

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

    const token = this.getStoredToken();
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

  private storeSession(user: User, token: string, rememberMe: boolean): void {
    if (this.isBrowser) {
      if (rememberMe) {
        localStorage.setItem('authToken', token);
        sessionStorage.removeItem('authToken');
      } else {
        sessionStorage.setItem('authToken', token);
        localStorage.removeItem('authToken');
      }

      localStorage.setItem('currentUser', JSON.stringify(user));
    }

    this.currentUserSubject.next(user);
  }

  private getStoredToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  private mapApiUser(apiUser: ApiUser): User {
    return {
      id: apiUser.id,
      email: apiUser.email,
      password: '',
      fullName: apiUser.full_name,
      address: apiUser.address ?? '',
      phone: apiUser.phone ?? '',
      role: apiUser.role,
      createdAt: new Date(apiUser.created_at)
    };
  }

  private buildAuthHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
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

      if (apiError?.errors) {
        const firstError = Object.values(apiError.errors)[0]?.[0];
        if (firstError) {
          return firstError;
        }
      }

      if (error.message) {
        return error.message;
      }
    }

    return 'Une erreur est survenue';
  }
}
