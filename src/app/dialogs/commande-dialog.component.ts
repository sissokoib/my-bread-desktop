import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CommandeCreationRequest,
  LigneQuantiteRequest,
  StockDisponible,
} from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { Utilisateur } from '../models/utilisateur.model';
import { CommandeService } from '../services/commande.service';
import { ProduitService } from '../services/produit.service';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-commande-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="valider()">
        <div class="dialog-header">
          <div>
            <h2>Nouvelle commande livreur</h2>
            <p class="page-sub">
              Enregistrez la demande de pains d'un livreur en fonction du stock produit disponible.
            </p>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreurLocale() || erreur()) {
          <div class="alert alert-error">{{ erreurLocale() || erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="cmd-livreur">Livreur demandeur *</label>
            <select id="cmd-livreur" name="livreurId" required [(ngModel)]="livreurId">
              <option [ngValue]="0" disabled>Choisir un livreur…</option>
              @for (l of livreurs(); track l.id) {
                <option [ngValue]="l.id">{{ l.nom }} ({{ l.telephone }})</option>
              }
              @if (livreurs().length === 0) {
                <option [ngValue]="0" disabled>Aucun livreur disponible</option>
              }
            </select>
          </div>

          <div class="field">
            <label for="cmd-date">Date de tournée / livraison souhaitée *</label>
            <input
              id="cmd-date"
              name="dateLivraisonSouhaitee"
              type="date"
              required
              [ngModel]="dateLivraisonSouhaitee"
              (ngModelChange)="auChangementDate($event)"
            />
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Prix standard</th>
                <th style="text-align: center">Stock produit dispo</th>
                <th class="num" style="width: 170px">Quantité commandée</th>
              </tr>
            </thead>
            <tbody>
              @for (p of produits(); track p.id) {
                <tr>
                  <td style="font-weight: 600">{{ p.nom }}</td>
                  <td class="num">{{ p.prixVente | number }} FCFA</td>
                  <td style="text-align: center">
                    @if (stocks()[p.id]; as st) {
                      @if (st.quantiteProduite === 0) {
                        <span class="badge" style="background: #F3F4F6; color: #6B7280; font-size: 0.78rem">
                          ⚠️ Non produit (0)
                        </span>
                      } @else if (st.stockDisponible <= 0) {
                        <span class="badge badge-warn" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; font-size: 0.78rem">
                          ❌ Épuisé (0 / {{ st.quantiteProduite }})
                        </span>
                      } @else {
                        <span class="badge badge-ok" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-size: 0.78rem">
                          ✅ {{ st.stockDisponible }} dispo
                        </span>
                        <div class="field-hint" style="font-size: 0.72rem; margin-top: 2px">
                          Produit : {{ st.quantiteProduite }} · Déjà cmd : {{ st.quantiteCommandee }}
                        </div>
                      }
                    } @else {
                      <span class="field-hint">Chargement stock…</span>
                    }
                  </td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      [name]="'qte_' + p.id"
                      [(ngModel)]="quantites[p.id]"
                      (ngModelChange)="erreurLocale.set(null)"
                      [style.borderColor]="estEnDepassement(p.id) ? '#DC2626' : null"
                      [style.backgroundColor]="estEnDepassement(p.id) ? '#FEF2F2' : null"
                      style="width: 120px; text-align: right"
                    />
                    @if (estEnDepassement(p.id)) {
                      <div style="color: #DC2626; font-size: 0.72rem; font-weight: 600; margin-top: 2px">
                        Max : {{ getStockDispo(p.id) }} dispo
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="field">
          <label for="cmd-rem">Remarques / instructions de tournée</label>
          <input
            id="cmd-rem"
            name="remarques"
            type="text"
            [(ngModel)]="remarques"
            placeholder="Ex. Prévoir pour la première livraison du matin"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-ghost" (click)="fermer.emit()">Annuler</button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="enCours() || !livreurId || aDesDepassements()"
          >
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer la commande' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CommandeDialogComponent implements OnInit {
  private readonly utilisateurService = inject(UtilisateurService);
  private readonly produitService = inject(ProduitService);
  private readonly commandeService = inject(CommandeService);

  readonly enCours = input(false);
  readonly erreur = input<string | null>(null);
  readonly enregistrer = output<CommandeCreationRequest>();
  readonly fermer = output<void>();

  protected readonly livreurs = signal<Utilisateur[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly stocks = signal<Record<number, StockDisponible>>({});
  protected readonly erreurLocale = signal<string | null>(null);

  protected livreurId = 0;
  protected dateLivraisonSouhaitee = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  protected quantites: Record<number, number> = {};
  protected remarques = '';

  ngOnInit(): void {
    this.utilisateurService.lister().subscribe({
      next: (users) => {
        const livs = users.filter(
          (u) =>
            u.role === 'LIVREUR' &&
            u.actif &&
            (!u.poste || u.poste.toLowerCase().includes('livreur')) &&
            !u.nom.toLowerCase().includes('djelimakan')
        );
        this.livreurs.set(livs);
        if (livs.length > 0) {
          this.livreurId = livs[0].id;
        } else {
          this.livreurId = 0;
        }
      },
      error: () => {},
    });

    this.produitService.lister().subscribe({
      next: (p) => {
        const actifs = p.filter((x) => x.actif);
        this.produits.set(actifs);
        for (const prod of actifs) {
          this.quantites[prod.id] = 0;
        }
        this.chargerStocks();
      },
      error: () => {},
    });
  }

  protected auChangementDate(nouvelleDate: string): void {
    this.dateLivraisonSouhaitee = nouvelleDate;
    this.erreurLocale.set(null);
    this.chargerStocks();
  }

  protected chargerStocks(): void {
    this.commandeService.stockDisponible(this.dateLivraisonSouhaitee).subscribe({
      next: (res) => {
        const map: Record<number, StockDisponible> = {};
        for (const item of res) {
          map[item.produitId] = item;
        }
        this.stocks.set(map);
      },
      error: () => {},
    });
  }

  protected getStockDispo(produitId: number): number {
    return this.stocks()[produitId]?.stockDisponible ?? 0;
  }

  protected estEnDepassement(produitId: number): boolean {
    const qte = Number(this.quantites[produitId] || 0);
    if (qte <= 0) return false;
    const dispo = this.getStockDispo(produitId);
    return qte > dispo;
  }

  protected aDesDepassements(): boolean {
    for (const [idStr, val] of Object.entries(this.quantites)) {
      const q = Number(val || 0);
      if (q > 0) {
        const dispo = this.getStockDispo(Number(idStr));
        if (q > dispo) return true;
      }
    }
    return false;
  }

  protected valider(): void {
    this.erreurLocale.set(null);
    const lignes: LigneQuantiteRequest[] = Object.entries(this.quantites)
      .map(([id, q]) => ({ produitId: Number(id), quantite: Number(q) }))
      .filter((l) => l.quantite > 0);

    if (!this.livreurId) {
      this.erreurLocale.set('Veuillez sélectionner un livreur.');
      return;
    }
    if (lignes.length === 0) {
      this.erreurLocale.set('Veuillez saisir une quantité supérieure à 0 pour au moins un produit.');
      return;
    }

    // Contrôle stock strict côté client avant envoi
    for (const l of lignes) {
      const st = this.stocks()[l.produitId];
      const prod = this.produits().find((p) => p.id === l.produitId);
      const nom = prod ? prod.nom : 'Produit';

      if (!st || st.quantiteProduite === 0) {
        this.erreurLocale.set(
          `Stock insuffisant : Aucune production enregistrée pour "${nom}" le ${this.dateLivraisonSouhaitee}. Enregistrez d'abord la production du matin.`
        );
        return;
      }

      if (st.stockDisponible <= 0) {
        this.erreurLocale.set(
          `Stock épuisé : Le produit "${nom}" est totalement épuisé pour le ${this.dateLivraisonSouhaitee} (Total produit : ${st.quantiteProduite}, Déjà commandé : ${st.quantiteCommandee}).`
        );
        return;
      }

      if (l.quantite > st.stockDisponible) {
        this.erreurLocale.set(
          `Stock insuffisant pour "${nom}" : il ne reste que ${st.stockDisponible} pain(s) disponible(s) en stock (vous avez demandé ${l.quantite}).`
        );
        return;
      }
    }

    this.enregistrer.emit({
      livreurId: this.livreurId,
      dateLivraisonSouhaitee: this.dateLivraisonSouhaitee,
      lignes,
      remarques: this.remarques.trim() || null,
    });
  }
}
