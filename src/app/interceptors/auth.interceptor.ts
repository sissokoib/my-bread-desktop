import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../services/api.config';
import { AuthService } from '../services/auth.service';

/** Ajoute le jeton JWT aux appels API et déconnecte l'utilisateur si la session ou l'abonnement expire. */
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const appelApi = requete.url.startsWith(API_URL);

  const requeteAuthentifiee =
    token && appelApi ? requete.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : requete;

  return suivant(requeteAuthentifiee).pipe(
    catchError((erreur: HttpErrorResponse) => {
      if (appelApi && !requete.url.endsWith('/auth/login')) {
        // Ne JAMAIS déconnecter brutalement si l'erreur concerne une opération d'administration, de prolongation, le module farine ou le back-office super-admin
        if (
          requete.url.includes('/super-admin') ||
          requete.url.includes('/prolonger') ||
          requete.url.includes('/farine') ||
          router.url.includes('super-admin')
        ) {
          console.warn('Erreur sur requête spécifique (session préservée) :', requete.url, erreur.status);
          return throwError(() => erreur);
        }

        const msg = erreur.error?.message;
        // Si l'abonnement est arrivé à échéance (403 Forbidden ou message d'échéance)
        if (
          (erreur.status === 403 || erreur.status === 401) &&
          msg &&
          (msg.toLowerCase().includes('abonnement') || msg.toLowerCase().includes('échéance'))
        ) {
          auth.logout(false);
          void router.navigate(['/connexion'], {
            queryParams: { erreur: msg },
          });
        } else if (erreur.status === 401) {
          console.warn('Session expirée ou non autorisée (401) sur:', requete.url);
          auth.logout(false);
          void router.navigate(['/connexion'], {
            queryParams: { erreur: 'Votre session a expiré ou est invalide. Veuillez vous reconnecter.' },
          });
        }
      }
      return throwError(() => erreur);
    }),
  );
};

