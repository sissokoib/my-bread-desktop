import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Commande,
  CommandeCreationRequest,
  StatutCommande,
  StockDisponible,
} from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class CommandeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_URL}/commandes`;

  lister(date?: string, statut?: StatutCommande | ''): Observable<Commande[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (statut) params = params.set('statut', statut);
    return this.http.get<Commande[]>(this.baseUrl, { params });
  }

  stockDisponible(date?: string): Observable<StockDisponible[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<StockDisponible[]>(`${this.baseUrl}/stock-disponible`, { params });
  }

  creer(requete: CommandeCreationRequest): Observable<Commande> {
    return this.http.post<Commande>(this.baseUrl, requete);
  }

  changerStatut(id: number, statut: StatutCommande): Observable<Commande> {
    return this.http.put<Commande>(`${this.baseUrl}/${id}/statut`, { statut });
  }
}

