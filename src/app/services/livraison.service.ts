import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Livraison, LivraisonCreationRequest } from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class LivraisonService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/livraisons`;

  lister(filtres?: { date?: string; tourneeId?: number; clientId?: number }) {
    let params = new HttpParams();
    if (filtres?.date) {
      params = params.set('date', filtres.date);
    }
    if (filtres?.tourneeId) {
      params = params.set('tourneeId', filtres.tourneeId);
    }
    if (filtres?.clientId) {
      params = params.set('clientId', filtres.clientId);
    }
    return this.http.get<Livraison[]>(this.url, { params });
  }

  creer(requete: LivraisonCreationRequest) {
    return this.http.post<Livraison>(this.url, requete);
  }
}

