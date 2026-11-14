import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Depense, DepenseRequest } from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class DepenseService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/depenses`;

  lister(date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<Depense[]>(this.url, { params });
  }

  creer(requete: DepenseRequest) {
    return this.http.post<Depense>(this.url, requete);
  }

  supprimer(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}

