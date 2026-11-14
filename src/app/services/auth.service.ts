import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import {
  LoginResponse,
  ProfilModificationRequest,
  Role,
  Utilisateur,
} from '../models/utilisateur.model';
import { API_URL } from './api.config';

const CLE_SESSION = 'my-bread.session';

interface Session {
  token: string;
  utilisateur: Utilisateur;
  /** Horodatage (ms) d'expiration du jeton. */
  expireA: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(this.charger());

  readonly utilisateur = computed(() => this.session()?.utilisateur ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly connecte = computed(() => this.session() !== null);

  login(telephone: string, motDePasse: string) {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, { telephone, motDePasse }).pipe(
      map((reponse) => {
        if (reponse.utilisateur.role === 'LIVREUR') {
          throw new Error(
            "Les comptes livreurs utilisent l'application mobile. Le tableau de bord est réservé à l'administration du fournil.",
          );
        }
        return reponse;
      }),
      tap((reponse) => this.enregistrer(reponse)),
    );
  }

  logout(redirection = true): void {
    localStorage.removeItem(CLE_SESSION);
    this.session.set(null);
    if (redirection) {
      void this.router.navigate(['/connexion']);
    }
  }

  aRole(...roles: Role[]): boolean {
    const utilisateur = this.utilisateur();
    return utilisateur !== null && roles.includes(utilisateur.role);
  }

  /**
   * Téléverse un fichier image dans le dossier "uploads/" du backend via multipart/form-data.
   * Le backend stocke uniquement l'URL "/uploads/..." en base de données.
   */
  televerserPhotoProfil(fichier: File): Observable<Utilisateur> {
    const formData = new FormData();
    formData.append('fichier', fichier);
    return this.http.post<LoginResponse>(`${API_URL}/auth/me/photo`, formData).pipe(
      tap((reponse) => this.enregistrer(reponse)),
      map((reponse) => reponse.utilisateur),
    );
  }

  /**
   * Supprime la photo de profil du dossier "uploads/" et remet photo_profil à NULL en base.
   */
  supprimerPhotoProfil(): Observable<Utilisateur> {
    return this.http.delete<LoginResponse>(`${API_URL}/auth/me/photo`).pipe(
      tap((reponse) => this.enregistrer(reponse)),
      map((reponse) => reponse.utilisateur),
    );
  }

  /**
   * Met à jour les informations du profil (nom, téléphone, mot de passe optionnel, ou URL photo).
   */
  mettreAJourProfil(requete: ProfilModificationRequest): Observable<Utilisateur> {
    return this.http.put<LoginResponse>(`${API_URL}/auth/me`, requete).pipe(
      tap((reponse) => this.enregistrer(reponse)),
      map((reponse) => reponse.utilisateur),
    );
  }

  private enregistrer(reponse: LoginResponse): void {
    const session: Session = {
      token: reponse.token,
      utilisateur: reponse.utilisateur,
      expireA: Date.now() + reponse.expireDansSecondes * 1000,
    };
    localStorage.setItem(CLE_SESSION, JSON.stringify(session));
    this.session.set(session);
  }

  private charger(): Session | null {
    try {
      const brut = localStorage.getItem(CLE_SESSION);
      if (!brut) {
        return null;
      }
      const session = JSON.parse(brut) as Session;
      if (!session.token || session.expireA <= Date.now()) {
        localStorage.removeItem(CLE_SESSION);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }
}
