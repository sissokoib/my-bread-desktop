import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AbsenceCreationRequest,
  AbsenceEmploye,
  Utilisateur,
  UtilisateurCreation,
  UtilisateurModification,
} from '../models/utilisateur.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class UtilisateurService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/utilisateurs`;

  lister() {
    return this.http.get<Utilisateur[]>(this.url);
  }

  creer(requete: UtilisateurCreation) {
    return this.http.post<Utilisateur>(this.url, requete);
  }

  modifier(id: number, requete: UtilisateurModification) {
    return this.http.put<Utilisateur>(`${this.url}/${id}`, requete);
  }

  changerMotDePasse(id: number, motDePasse: string) {
    return this.http.put<void>(`${this.url}/${id}/mot-de-passe`, { motDePasse });
  }

  enregistrerAbsence(id: number, requete: AbsenceCreationRequest) {
    return this.http.post<AbsenceEmploye>(`${this.url}/${id}/absences`, requete);
  }

  listerAbsences(id: number) {
    return this.http.get<AbsenceEmploye[]>(`${this.url}/${id}/absences`);
  }

  supprimerAbsence(absenceId: number) {
    return this.http.delete<void>(`${this.url}/absences/${absenceId}`);
  }
}

