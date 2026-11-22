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
            <h2>Nouveau chargement livreur</h2>
            <p class="page-sub">
              Enregistrez les pains remis au livreur pour sa sortie du matin ou du soir.
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <!-- Sélecteur de moment / créneau de la sortie -->
        <div style="margin-bottom: 1.15rem">
          <label style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 0.45rem">
            Créneau de la sortie *
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.65rem">
            <button
              type="button"
              (click)="creneau = 'MATIN'"
              [style.background]="creneau === 'MATIN' ? '#FEF3C7' : '#F9FAFB'"
              [style.borderColor]="creneau === 'MATIN' ? '#D97706' : '#E5E7EB'"
              [style.color]="creneau === 'MATIN' ? '#92400E' : '#4B5563'"
              style="padding: 0.7rem 0.6rem; border: 2px solid; border-radius: 12px; font-weight: 700; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.15s"
            >
              <span class="material-symbols-outlined" style="font-size: 1.4rem; color: #D97706">wb_sunny</span>
              <span style="font-size: 0.84rem">Sortie du Matin</span>
            </button>

            <button
              type="button"
              (click)="creneau = 'SOIR'"
              [style.background]="creneau === 'SOIR' ? '#EDE9FE' : '#F9FAFB'"
              [style.borderColor]="creneau === 'SOIR' ? '#7C3AED' : '#E5E7EB'"
              [style.color]="creneau === 'SOIR' ? '#5B21B6' : '#4B5563'"
              style="padding: 0.7rem 0.6rem; border: 2px solid; border-radius: 12px; font-weight: 700; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.15s"
            >
              <span class="material-symbols-outlined" style="font-size: 1.4rem; color: #7C3AED">dark_mode</span>
              <span style="font-size: 0.84rem">Sortie du Soir</span>
            </button>

            <button
              type="button"
              (click)="creneau = 'REAPPRO'"
              [style.background]="creneau === 'REAPPRO' ? '#ECFDF5' : '#F9FAFB'"
              [style.borderColor]="creneau === 'REAPPRO' ? '#059669' : '#E5E7EB'"
              [style.color]="creneau === 'REAPPRO' ? '#065F46' : '#4B5563'"
              style="padding: 0.7rem 0.6rem; border: 2px solid; border-radius: 12px; font-weight: 700; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.15s"
            >
              <span class="material-symbols-outlined" style="font-size: 1.4rem; color: #059669">sync</span>
              <span style="font-size: 0.84rem">Réapprovisionnement</span>
            </button>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="livreurInput">Livreur assigné à la sortie *</label>
            <div style="position: relative">
              <input
                id="livreurInput"
                name="livreurNomSaisi"
                type="text"
                required
                list="livreursSuggestions"
                [(ngModel)]="livreurNomSaisi"
                (ngModelChange)="onLivreurNomChange($event)"
                placeholder="Tapez un nom ou sélectionnez (ex. Moussa Traoré...)"
              />
              <datalist id="livreursSuggestions">
                @for (l of livreurs; track l.id) {
                  <option [value]="l.nom">{{ l.nom }} ({{ l.telephone }})</option>
                }
              </datalist>
            </div>
          </div>

          <div class="field">
            <label for="dateTournee">Date de la sortie *</label>
            <input id="dateTournee" name="dateTournee" type="date" required [(ngModel)]="dateTournee" />
          </div>
        </div>

        <!-- TABLEAU DES PAINS CHARGÉS -->
        <div class="table-wrap" style="flex-shrink: 0; width: 100%">
          <table style="width: 100%; min-width: 520px; border-collapse: collapse">
            <thead>
              <tr>
                <th>Produit à confier</th>
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
                      style="width: 120px; text-align: right; font-weight: 700"
                      [name]="'charge_' + p.id"
                      [(ngModel)]="quantites[p.id]"
                    />
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="empty">Aucun produit actif disponible.</td>
                </tr>
              }
            </tbody>
            @if (calculerTotalPains() > 0) {
              <tfoot>
                <tr style="background: #F9FAFB; font-weight: 700">
                  <td>Total confié au livreur</td>
                  <td class="num" style="color: #8B5A2B">Valeur : {{ calculerValeurTotale() | number }} FCFA</td>
                  <td class="num" style="color: #059669; font-size: 1rem">{{ calculerTotalPains() | number }} pains</td>
                </tr>
              </tfoot>
            }
          </table>
        </div>

        <div class="field" style="margin-top: 0.85rem">
          <label for="remarquesTournee">Remarques éventuelles</label>
          <input
            id="remarquesTournee"
            name="remarques"
            type="text"
            [(ngModel)]="remarques"
            placeholder="Ex. Secteur Sabalibougou / 1ère tournée du matin"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours() || !livreurNomSaisi.trim()">
            {{ enCours() ? 'Enregistrement…' : 'Valider le départ du livreur' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class TourneeDialogComponent implements OnInit {
  private readonly service = inject(TourneeService);

  @Input({ required: true }) livreurs!: Utilisateur[];
  @Input({ required: true }) produits!: Produit[];
  @Input() dateParDefaut = '';
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Tournee>();

  protected creneau: 'MATIN' | 'SOIR' | 'REAPPRO' = 'MATIN';
  protected livreurNomSaisi = '';
  protected livreurId: number | null = null;
  protected nomLivreurLibre: string | null = null;
  protected dateTournee = '';
  protected remarques = '';
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

  protected calculerTotalPains(): number {
    return Object.values(this.quantites).reduce((sum, q) => sum + (Number(q) || 0), 0);
  }

  protected calculerValeurTotale(): number {
    return this.produits.reduce((sum, p) => {
      const q = Number(this.quantites[p.id] || 0);
      return sum + q * p.prixVente;
    }, 0);
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
      if (!this.livreurId && this.livreurs.length > 0) {
        this.livreurId = this.livreurs[0].id;
      }
      this.nomLivreurLibre = nettoye;
    }
  }

  protected enregistrer(): void {
    const nomFinal = this.livreurNomSaisi.trim();
    if (!nomFinal) {
      this.erreur.set('Veuillez indiquer le nom du livreur qui part.');
      return;
    }

    this.onLivreurNomChange(nomFinal);
    if (!this.livreurId && this.livreurs.length > 0) {
      this.livreurId = this.livreurs[0].id;
    }

    if (!this.livreurId) {
      this.erreur.set('Aucun compte livreur disponible pour enregistrer la sortie.');
      return;
    }

    const chargements = Object.entries(this.quantites)
      .map(([id, qte]) => ({ produitId: Number(id), quantite: Math.round(qte || 0) }))
      .filter((l) => l.quantite > 0);

    if (chargements.length === 0) {
      this.erreur.set('Saisissez une quantité chargée positive pour au moins un produit.');
      return;
    }

    let tag = '[Matin]';
    if (this.creneau === 'SOIR') tag = '[Soir]';
    else if (this.creneau === 'REAPPRO') tag = '[Réappro]';

    let remarquesFinal = this.remarques.trim();
    if (!remarquesFinal.includes(tag)) {
      remarquesFinal = `${tag} ${remarquesFinal}`.trim();
    }

    this.enCours.set(true);
    this.erreur.set(null);

    this.service
      .creer({
        dateTournee: this.dateTournee,
        livreurId: this.livreurId,
        nomLivreurLibre: this.nomLivreurLibre || nomFinal,
        remarques: remarquesFinal,
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
