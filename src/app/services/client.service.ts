import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Client, ClientRequest, PrixClient } from '../models/client.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/clients`;

  lister() {
    return this.http.get<Client[]>(this.url);
  }

  creer(requete: ClientRequest) {
    return this.http.post<Client>(this.url, requete);
  }

  modifier(id: number, requete: ClientRequest) {
    return this.http.put<Client>(`${this.url}/${id}`, requete);
  }

  listerPrix(clientId: number) {
    return this.http.get<PrixClient[]>(`${this.url}/${clientId}/prix`);
  }

  definirPrix(clientId: number, produitId: number, prix: number) {
    return this.http.put<PrixClient>(`${this.url}/${clientId}/prix/${produitId}`, { prix });
  }

  supprimerPrix(clientId: number, produitId: number) {
    return this.http.delete<void>(`${this.url}/${clientId}/prix/${produitId}`);
  }
}

