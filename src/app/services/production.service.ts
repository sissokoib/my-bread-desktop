import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Production, ProductionRequest } from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/productions`;

  lister(date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<Production[]>(this.url, { params });
  }

  creer(requete: ProductionRequest) {
    return this.http.post<Production>(this.url, requete);
  }

  supprimer(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}

