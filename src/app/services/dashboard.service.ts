import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DashboardResume } from '../models/operations.model';
import { API_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/dashboard`;

  obtenirResume(date?: string) {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<DashboardResume>(`${this.url}/resume`, { params });
  }
}

