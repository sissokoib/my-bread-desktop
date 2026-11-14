import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Boulangerie,
  BoulangerieCreationRequest,
  ProlongerAbonnementRequest,
  Role,
  SuperAdminPlateforme,
  Utilisateur,
} from '../models/utilisateur.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/super-admin`;

  obtenirVuePlateforme() {
    return this.http.get<SuperAdminPlateforme>(`${this.url}/plateforme`);
  }

  // --- Gestion des Boulangeries Multi-Tenant & Abonnements SaaS ---
  listerBoulangeries() {
    return this.http.get<Boulangerie[]>(`${this.url}/boulangeries`);
  }

  creerBoulangerie(requete: BoulangerieCreationRequest) {
    return this.http.post<Boulangerie>(`${this.url}/boulangeries`, requete);
  }

  prolongerAbonnement(boulangerieId: number, requete: ProlongerAbonnementRequest) {
    return this.http.put<Boulangerie>(`${this.url}/boulangeries/${boulangerieId}/prolonger`, requete);
  }

  forcerExpirationEssai(boulangerieId: number) {
    return this.http.put<Boulangerie>(`${this.url}/boulangeries/${boulangerieId}/expirer-essai`, {});
  }

  changerStatutBoulangerie(boulangerieId: number, actif: boolean) {
    const params = new HttpParams().set('actif', actif);
    return this.http.put<Boulangerie>(`${this.url}/boulangeries/${boulangerieId}/statut`, {}, { params });
  }

  // --- Gestion des Utilisateurs et Comptes Globaux ---
  changerStatutCompte(id: number, actif: boolean) {
    const params = new HttpParams().set('actif', actif);
    return this.http.put<Utilisateur>(`${this.url}/utilisateurs/${id}/statut`, {}, { params });
  }

  changerRoleCompte(id: number, role: Role) {
    const params = new HttpParams().set('role', role);
    return this.http.put<Utilisateur>(`${this.url}/utilisateurs/${id}/role`, {}, { params });
  }

  reinitialiserOperations() {
    return this.http.post<void>(`${this.url}/reinitialiser-operations`, {});
  }
}
