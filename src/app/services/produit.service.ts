import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Produit, ProduitRequest } from '../models/produit.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ProduitService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/produits`;

  lister() {
    return this.http.get<Produit[]>(this.url);
  }

  creer(requete: ProduitRequest) {
    return this.http.post<Produit>(this.url, requete);
  }

  modifier(id: number, requete: ProduitRequest) {
    return this.http.put<Produit>(`${this.url}/${id}`, requete);
  }
}

