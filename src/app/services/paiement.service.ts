import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ClientSolde,
  Paiement,
  PaiementCreationRequest,
} from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class PaiementService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/paiements`;

  lister(filtres?: { date?: string; clientId?: number; tourneeId?: number }) {
    let params = new HttpParams();
    if (filtres?.date) {
      params = params.set('date', filtres.date);
    }
    if (filtres?.clientId) {
      params = params.set('clientId', filtres.clientId);
    }
    if (filtres?.tourneeId) {
      params = params.set('tourneeId', filtres.tourneeId);
    }
    return this.http.get<Paiement[]>(this.url, { params });
  }

  creer(requete: PaiementCreationRequest) {
    return this.http.post<Paiement>(this.url, requete);
  }

  listerSoldes() {
    return this.http.get<ClientSolde[]>(`${this.url}/soldes`);
  }
}

