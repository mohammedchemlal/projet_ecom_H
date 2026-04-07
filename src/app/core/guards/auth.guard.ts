import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { STATIC_NAVIGATION_MODE } from '../config/static-mode';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
	if (STATIC_NAVIGATION_MODE) {
		return true;
	}

	const authService = inject(AuthService);
	const router = inject(Router);

	return authService.isLoggedIn() ? true : router.parseUrl('/auth/login');
};
