import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Évite d'afficher la page de connexion à quelqu'un qui est déjà connecté. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.connecte() ? inject(Router).createUrlTree(['/tableau-de-bord']) : true;
};

