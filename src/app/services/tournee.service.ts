import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Tournee,
  TourneeClotureRequest,
  TourneeCreationRequest,
} from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class TourneeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/tournees`;

  lister(date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<Tournee[]>(this.url, { params });
  }

  obtenir(id: number) {
    return this.http.get<Tournee>(`${this.url}/${id}`);
  }

  creer(requete: TourneeCreationRequest) {
    return this.http.post<Tournee>(this.url, requete);
  }

  demarrer(id: number) {
    return this.http.post<Tournee>(`${this.url}/${id}/demarrer`, {});
  }

  cloturer(id: number, requete: TourneeClotureRequest) {
    return this.http.post<Tournee>(`${this.url}/${id}/cloturer`, requete);
  }
}

