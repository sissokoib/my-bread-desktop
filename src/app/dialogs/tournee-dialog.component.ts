import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Tournee } from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { Utilisateur } from '../models/utilisateur.model';
import { messageErreur } from '../services/message-erreur';
import { TourneeService } from '../services/tournee.service';

@Component({
  selector: 'app-tournee-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>Enregistrer des pains livrés</h2>
            <p class="page-sub">
              Enregistrez les pains sortis du fournil pour un événement client (Baptême, Mariage, Anniversaire...) ou une distribution.
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="livreurInput">Livreur ou employé qui effectue la livraison *</label>
            <div style="position: relative">
              <input
                id="livreurInput"
                name="livreurNomSaisi"
                type="text"
                required
                list="livreursSuggestions"
                [(ngModel)]="livreurNomSaisi"
                (ngModelChange)="onLivreurNomChange($event)"
                placeholder="Tapez un nom (ex. Bourama, Chauffeur Salif, Moussa...) ou sélectionnez"
              />
              <datalist id="livreursSuggestions">
                @for (l of livreurs; track l.id) {
                  <option [value]="l.nom">{{ l.nom }} ({{ l.telephone }})</option>
                }
              </datalist>
            </div>
            <div class="field-hint">
              Saisissez librement le nom de la personne qui livre (employé du fournil, chauffeur, livreur attitré).
            </div>
          </div>

          <div class="field">
            <label for="dateTournee">Date de la livraison *</label>
            <input id="dateTournee" name="dateTournee" type="date" required [(ngModel)]="dateTournee" />
          </div>
        </div>

        <div class="field">
          <label for="remTournee">Nature de la livraison &amp; Détails (Événement / Client) *</label>
          <div class="nature-tags">
            <button
              type="button"
              class="nature-tag-btn"
              [class.active]="evenementActif === 'Baptême'"
              (click)="choisirTypeEvenement('Baptême')"
            >
              👶 Baptême
            </button>
            <button
              type="button"
              class="nature-tag-btn"
              [class.active]="evenementActif === 'Mariage'"
              (click)="choisirTypeEvenement('Mariage')"
            >
              💍 Mariage
            </button>
            <button
              type="button"
              class="nature-tag-btn"
              [class.active]="evenementActif === 'Anniversaire'"
              (click)="choisirTypeEvenement('Anniversaire')"
            >
              🎂 Anniversaire
            </button>
            <button
              type="button"
              class="nature-tag-btn"
              [class.active]="evenementActif === 'Cérémonie'"
              (click)="choisirTypeEvenement('Cérémonie')"
            >
              🎉 Cérémonie / Fête
            </button>
            <button
              type="button"
              class="nature-tag-btn"
              [class.active]="evenementActif === 'Distribution'"
              (click)="choisirTypeEvenement('Distribution générale')"
            >
              🚚 Distribution générale
            </button>
          </div>
          <input
            id="remTournee"
            name="remarques"
            type="text"
            maxlength="255"
            [(ngModel)]="remarques"
            placeholder="Ex. Baptême chez Famille Traoré (Badalabougou) — à livrer avant 7h"
          />
          <div class="field-hint">
            Précisez pour quel événement ou client les pains sont livrés au nom de la boulangerie.
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit à charger</th>
                <th class="num">Prix standard</th>
                <th class="num" style="width: 160px">Quantité chargée</th>
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
                      step="1"
                      style="width: 120px; text-align: right"
                      [name]="'charge_' + p.id"
                      [(ngModel)]="quantites[p.id]"
                    />
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="empty">Aucun produit actif.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours() || !livreurNomSaisi.trim()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer les pains livrés' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .nature-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-bottom: 0.55rem;
      }

      .nature-tag-btn {
        border: 1px solid #E5E7EB;
        background: #F9FAFB;
        color: #374151;
        border-radius: 9999px;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.28rem 0.65rem;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .nature-tag-btn:hover {
        background: #FEF3C7;
        border-color: #F59E0B;
        color: #92400E;
      }

      .nature-tag-btn.active {
        background: #DEAB38;
        border-color: #B45309;
        color: #FFFFFF;
      }
    `,
  ],
})
export class TourneeDialogComponent implements OnInit {
  private readonly service = inject(TourneeService);

  @Input({ required: true }) livreurs!: Utilisateur[];
  @Input({ required: true }) produits!: Produit[];
  @Input() dateParDefaut = '';
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Tournee>();

  protected livreurNomSaisi = '';
  protected livreurId: number | null = null;
  protected nomLivreurLibre: string | null = null;
  protected dateTournee = '';
  protected remarques = '';
  protected evenementActif = '';
  protected quantites: Record<number, number> = {};
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.dateTournee = this.dateParDefaut || new Date().toISOString().slice(0, 10);
    if (this.livreurs && this.livreurs.length > 0) {
      this.livreurId = this.livreurs[0].id;
      this.livreurNomSaisi = this.livreurs[0].nom;
    }
    for (const p of this.produits) {
      this.quantites[p.id] = 0;
    }
  }

  protected onLivreurNomChange(val: string): void {
    const nettoye = (val || '').trim();
    if (!nettoye) {
      this.nomLivreurLibre = null;
      return;
    }
    const match = this.livreurs.find(
      (l) => l.nom.toLowerCase() === nettoye.toLowerCase() || l.telephone === nettoye
    );
    if (match) {
      this.livreurId = match.id;
      this.nomLivreurLibre = null;
    } else {
      // Nom libre : on conserve un id valide (le 1er ou actuel) pour la contrainte FK backend
      if (!this.livreurId && this.livreurs.length > 0) {
        this.livreurId = this.livreurs[0].id;
      }
      this.nomLivreurLibre = nettoye;
    }
  }

  protected choisirTypeEvenement(type: string): void {
    this.evenementActif = type;
    const prefixe = `${type} - `;
    if (!this.remarques.trim()) {
      this.remarques = prefixe;
    } else {
      // Remplacer l'ancien préfixe s'il y en avait un
      const nettoye = this.remarques.replace(
        /^(Baptême|Mariage|Anniversaire|Cérémonie|Tournée habituelle|Tournée classique)\s*[-:]\s*/i,
        ''
      );
      this.remarques = `${prefixe}${nettoye}`;
    }
  }

  protected enregistrer(): void {
    const nomFinal = this.livreurNomSaisi.trim();
    if (!nomFinal) {
      this.erreur.set('Veuillez indiquer le nom de la personne qui effectue la livraison.');
      return;
    }

    // Assurer que livreurId est résolu
    this.onLivreurNomChange(nomFinal);
    if (!this.livreurId && this.livreurs.length > 0) {
      this.livreurId = this.livreurs[0].id;
    }

    if (!this.livreurId) {
      this.erreur.set('Aucun compte utilisateur référent disponible pour enregistrer la livraison.');
      return;
    }

    const chargements = Object.entries(this.quantites)
      .map(([id, qte]) => ({ produitId: Number(id), quantite: Math.round(qte || 0) }))
      .filter((l) => l.quantite > 0);

    if (chargements.length === 0) {
      this.erreur.set('Saisissez une quantité chargée positive pour au moins un produit.');
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    this.service
      .creer({
        dateTournee: this.dateTournee,
        livreurId: this.livreurId,
        nomLivreurLibre: this.nomLivreurLibre || nomFinal,
        remarques: this.remarques.trim() || null,
        chargements,
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
