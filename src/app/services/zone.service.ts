import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Zone } from '../models/zone.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/zones`;

  lister() {
    return this.http.get<Zone[]>(this.url);
  }

  creer(nom: string) {
    return this.http.post<Zone>(this.url, { nom });
  }

  modifier(id: number, nom: string) {
    return this.http.put<Zone>(`${this.url}/${id}`, { nom });
  }
}

