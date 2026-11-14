import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Réserve une route aux utilisateurs connectés. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.connecte()) {
    return router.createUrlTree(['/connexion']);
  }
  if (auth.utilisateur()?.role === 'PDG') {
    auth.logout(false);
    return router.createUrlTree(['/connexion'], {
      queryParams: {
        message: "L'accès PDG est réservé exclusivement à l'application mobile My Bread. Veuillez vous connecter depuis votre téléphone.",
      },
    });
  }
  return true;
};

