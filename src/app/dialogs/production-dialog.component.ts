import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Production } from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { messageErreur } from '../services/message-erreur';
import { ProductionService } from '../services/production.service';

@Component({
  selector: 'app-production-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>Nouvelle fournée de production</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="dateProd">Date de production</label>
            <input id="dateProd" name="dateProduction" type="date" required [(ngModel)]="dateProduction" />
          </div>
          <div class="field">
            <label for="sacsFarine">Farine utilisée (sacs 50 kg)</label>
            <input
              id="sacsFarine"
              name="sacsFarine"
              type="number"
              min="0"
              [(ngModel)]="sacsFarineUtilises"
              placeholder="Ex. 8 sacs"
            />
          </div>
          <div class="field">
            <label for="remProd">Remarques (équipe, fournée…)</label>
            <input
              id="remProd"
              name="remarques"
              type="text"
              maxlength="255"
              [(ngModel)]="remarques"
              placeholder="Ex. Fournée du matin 5h"
            />
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Prix vente</th>
                <th class="num">Quantité produite</th>
              </tr>
            </thead>
            <tbody>
              @for (p of produits; track p.id) {
                <tr>
                  <td>
                    <strong>{{ p.nom }}</strong>
                  </td>
                  <td class="num">{{ p.prixVente | number }} FCFA</td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      style="width: 120px"
                      [name]="'qte_' + p.id"
                      [(ngModel)]="quantites[p.id]"
                    />
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="empty">Aucun produit actif. Créez d'abord un produit.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer la fournée' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ProductionDialogComponent implements OnInit {
  private readonly service = inject(ProductionService);

  @Input({ required: true }) produits!: Produit[];
  @Input() dateParDefaut = '';
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Production>();

  protected dateProduction = '';
  protected remarques = '';
  protected sacsFarineUtilises: number | null = null;
  protected quantites: Record<number, number> = {};
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.dateProduction = this.dateParDefaut || new Date().toISOString().slice(0, 10);
    for (const p of this.produits) {
      this.quantites[p.id] = 0;
    }
  }

  protected enregistrer(): void {
    const lignes = Object.entries(this.quantites)
      .map(([id, qte]) => ({ produitId: Number(id), quantite: Math.round(qte || 0) }))
      .filter((l) => l.quantite > 0);
    if (lignes.length === 0) {
      this.erreur.set('Saisissez une quantité positive pour au moins un produit.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service
      .creer({
        dateProduction: this.dateProduction,
        remarques: this.remarques.trim() || null,
        sacsFarineUtilises: this.sacsFarineUtilises ? Math.round(this.sacsFarineUtilises) : 0,
        lignes,
      })
      .subscribe({
        next: (res) => {
          this.enCours.set(false);
          this.enregistre.emit(res);
        },
        error: (err) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }
}

