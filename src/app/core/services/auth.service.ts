import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';

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

interface ApiMeResponse {
  user: ApiUser;
}

interface ApiMessageResponse {
  message: string;
}

interface ApiAdminUsersResponse {
  data: ApiUser[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface ApiAdminUserResponse {
  data: ApiUser;
}

type RegisterPayload = Pick<User, 'email' | 'password' | 'fullName' | 'phone'> & {
  confirmPassword?: string;
  address?: string;
};

type AdminUserPayload = Pick<User, 'email' | 'fullName' | 'phone' | 'role'> & {
  address?: string;
  password?: string;
};

type AdminUsersQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  role?: User['role'] | 'all';
};

type AdminUsersResult = {
  users: User[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiBaseUrl = `${environment.apiUrl}/auth`;
  private readonly adminApiBaseUrl = `${environment.apiUrl}/admin/users`;

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

    this.clearSession();
  }

  verifyAdminAccess(): Observable<boolean> {
    const token = this.getStoredToken();

    if (!token) {
      this.clearSession();
      return of(false);
    }

    return this.http
      .get<ApiMeResponse>(`${this.apiBaseUrl}/me`, {
        headers: this.buildAuthHeaders(token)
      })
      .pipe(
        map((response) => this.mapApiUser(response.user)),
        tap((user) => {
          if (this.isBrowser) {
            localStorage.setItem('currentUser', JSON.stringify(user));
          }

          this.currentUserSubject.next(user);
        }),
        map((user) => user.role === 'admin'),
        catchError(() => {
          this.clearSession();
          return of(false);
        })
      );
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
    const token = this.getStoredToken();

    if (!token) {
      return of([]);
    }

    return this.getAdminUsers({ perPage: 100 }).pipe(map((response) => response.users));
  }

  getAdminUsers(query: AdminUsersQuery = {}): Observable<AdminUsersResult> {
    const token = this.getStoredToken();

    if (!token) {
      return of({
        users: [],
        meta: {
          currentPage: 1,
          lastPage: 1,
          perPage: query.perPage ?? 10,
          total: 0
        }
      });
    }

    let params = new HttpParams();

    if (query.page) {
      params = params.set('page', String(query.page));
    }

    if (query.perPage) {
      params = params.set('per_page', String(query.perPage));
    }

    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    if (query.role === 'admin' || query.role === 'visitor') {
      params = params.set('role', query.role);
    }

    return this.http
      .get<ApiAdminUsersResponse>(this.adminApiBaseUrl, {
        headers: this.buildAuthHeaders(token),
        params
      })
      .pipe(
        map((response) => ({
          users: response.data.map((apiUser) => this.mapApiUser(apiUser)),
          meta: {
            currentPage: response.meta?.current_page ?? 1,
            lastPage: response.meta?.last_page ?? 1,
            perPage: response.meta?.per_page ?? (query.perPage ?? 10),
            total: response.meta?.total ?? response.data.length
          }
        })),
        catchError((error) => {
          this.handleUnauthorized(error);
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  createUser(userData: AdminUserPayload): Observable<User> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Authentification requise'));
    }

    return this.http
      .post<ApiAdminUserResponse>(
        this.adminApiBaseUrl,
        {
          full_name: userData.fullName,
          email: userData.email,
          phone: userData.phone,
          address: userData.address ?? '',
          role: userData.role,
          password: userData.password
        },
        {
          headers: this.buildAuthHeaders(token)
        }
      )
      .pipe(
        map((response) => this.mapApiUser(response.data)),
        catchError((error) => {
          this.handleUnauthorized(error);
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  updateUser(userId: number, userData: Partial<AdminUserPayload>): Observable<User> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Authentification requise'));
    }

    const payload: Record<string, unknown> = {};

    if (userData.fullName !== undefined) {
      payload['full_name'] = userData.fullName;
    }

    if (userData.email !== undefined) {
      payload['email'] = userData.email;
    }

    if (userData.phone !== undefined) {
      payload['phone'] = userData.phone;
    }

    if (userData.address !== undefined) {
      payload['address'] = userData.address;
    }

    if (userData.role !== undefined) {
      payload['role'] = userData.role;
    }

    if (userData.password) {
      payload['password'] = userData.password;
    }

    return this.http
      .patch<{ data: ApiUser }>(`${this.adminApiBaseUrl}/${userId}`, payload, {
        headers: this.buildAuthHeaders(token)
      })
      .pipe(
        map((response) => {
          const updatedUser = this.mapApiUser(response.data);
          const currentUser = this.currentUserSubject.value;

          if (currentUser?.id === userId) {
            if (this.isBrowser) {
              localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }

            this.currentUserSubject.next(updatedUser);
          }

          return updatedUser;
        }),
        catchError((error) => {
          this.handleUnauthorized(error);
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  deleteUser(userId: number): Observable<void> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Authentification requise'));
    }

    return this.http.delete<void>(`${this.adminApiBaseUrl}/${userId}`, { headers: this.buildAuthHeaders(token) }).pipe(
      catchError((error) => {
        this.handleUnauthorized(error);
        return throwError(() => new Error(this.getApiErrorMessage(error)));
      })
    );
  }

  private handleUnauthorized(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.clearSession();
    }
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }

    const payload: Record<string, unknown> = {};

    if (userData.fullName !== undefined) {
      payload['full_name'] = userData.fullName;
    }

    if (userData.email !== undefined) {
      payload['email'] = userData.email;
    }

    if (userData.phone !== undefined) {
      payload['phone'] = userData.phone;
    }

    if (userData.address !== undefined) {
      payload['address'] = userData.address;
    }

    return this.http
      .patch<ApiMeResponse>(`${this.apiBaseUrl}/me`, payload, {
        headers: this.buildAuthHeaders(token)
      })
      .pipe(
        map((response) => this.mapApiUser(response.user)),
        tap((updatedUser) => {
          if (this.isBrowser) {
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }

          this.currentUserSubject.next(updatedUser);
        }),
        catchError((error) => {
          this.handleUnauthorized(error);
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Observable<void> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }

    return this.http
      .post<ApiMessageResponse>(
        `${this.apiBaseUrl}/change-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword
        },
        {
          headers: this.buildAuthHeaders(token)
        }
      )
      .pipe(
        map(() => void 0),
        catchError((error) => {
          this.handleUnauthorized(error);
          return throwError(() => new Error(this.getApiErrorMessage(error)));
        })
      );
  }

  deleteMyAccount(): Observable<void> {
    const token = this.getStoredToken();

    if (!token) {
      return throwError(() => new Error('Utilisateur non connecté'));
    }

    return this.http.delete<ApiMessageResponse>(`${this.apiBaseUrl}/me`, { headers: this.buildAuthHeaders(token) }).pipe(
      tap(() => this.clearSession()),
      map(() => void 0),
      catchError((error) => {
        this.handleUnauthorized(error);
        return throwError(() => new Error(this.getApiErrorMessage(error)));
      })
    );
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

  private clearSession(): void {
    if (this.isBrowser) {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    }

    this.currentUserSubject.next(null);
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

      if (error.message) {
        return error.message;
      }
    }

    return 'Une erreur est survenue';
  }
}
