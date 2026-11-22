import { HttpErrorResponse } from '@angular/common/http';
import { ErreurApi } from '../models/erreur-api.model';
import { API_URL } from './api.config';

/** Transforme n'importe quelle erreur en message lisible pour l'utilisateur. */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      if (API_URL.includes('onrender.com')) {
        return 'Impossible de joindre le serveur Cloud. Le serveur hébergé est peut-être en cours de réveil (patientez ~30 secondes) ou vérifiez votre connexion Internet.';
      }
      return 'Impossible de joindre le serveur. Vérifiez que le backend est démarré ou vérifiez votre connexion Internet.';
    }
    const corps = erreur.error as ErreurApi | null;
    const champs = corps?.erreurs ? Object.entries(corps.erreurs) : [];
    if (champs.length > 0) {
      return champs.map(([champ, message]) => `${champ} : ${message}`).join(' · ');
    }
    if (corps?.message) {
      return corps.message;
    }
    if (erreur.status === 403) {
      return "Vous n'avez pas le droit d'effectuer cette action.";
    }
    if (erreur.status === 401) {
      return 'Session expirée ou identifiants incorrects.';
    }
  } else if (erreur instanceof Error) {
    return erreur.message;
  }
  return "Une erreur inattendue s'est produite.";
}

