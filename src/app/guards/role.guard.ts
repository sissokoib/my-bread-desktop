import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/utilisateur.model';
import { AuthService } from '../services/auth.service';

/** Réserve une route à certains rôles. */
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return auth.aRole(...roles) ? true : inject(Router).createUrlTree(['/tableau-de-bord']);
  };

