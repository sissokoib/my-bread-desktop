import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApprovisionnementFarine,
  ApprovisionnementFarineRequest,
  BilanFarine,
} from '../models/farine.model';
import { API_URL } from './api.config';

export * from '../models/farine.model';

@Injectable({ providedIn: 'root' })
export class FarineService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/farine`;

  obtenirBilan() {
    return this.http.get<BilanFarine>(`${this.url}/bilan`);
  }

  mettreAJourParametres(params: {
    rendementBaguettesSac?: number;
    seuilAlerteFarine?: number;
    stockActuelSacs?: number;
  }) {
    return this.http.put<BilanFarine>(`${this.url}/parametres`, params);
  }

  ajouterApprovisionnement(req: ApprovisionnementFarineRequest) {
    return this.http.post<ApprovisionnementFarine>(`${this.url}/approvisionnements`, req);
  }

  listerApprovisionnements() {
    return this.http.get<ApprovisionnementFarine[]>(`${this.url}/approvisionnements`);
  }
}
