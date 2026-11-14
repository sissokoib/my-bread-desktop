import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MotifRetour, RetourPainRequest, Tournee } from '../models/operations.model';
import { messageErreur } from '../services/message-erreur';
import { TourneeService } from '../services/tournee.service';

interface SaisieRetour {
  produitId: number;
  produitNom: string;
  attendu: number;
  quantite: number;
  motif: MotifRetour;
}

@Component({
  selector: 'app-tournee-cloture-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="cloturer()">
        <div class="dialog-header">
          <div>
            <h2>Déduire les retours d'invendus de {{ tournee.livreurNom }}</h2>
            <p class="page-sub">
              Saisissez les pains invendus ou avariés retournés au fournil pour déduction immédiate de ce décompte.
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Pains sortis</th>
                <th class="num">Pains retournés</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              @for (s of saisies; track s.produitId) {
                <tr>
                  <td>
                    <strong>{{ s.produitNom }}</strong>
                  </td>
                  <td class="num">{{ s.attendu }}</td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      [max]="s.attendu"
                      style="width: 110px"
                      [name]="'ret_' + s.produitId"
                      [(ngModel)]="s.quantite"
                    />
                  </td>
                  <td>
                    <select [name]="'motif_' + s.produitId" [(ngModel)]="s.motif">
                      <option value="INVENDU">Invendu</option>
                      <option value="ABIME">Abîmé</option>
                      <option value="PERTE">Perte</option>
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="field">
          <label for="remCloture">Observations / Justification (optionnel)</label>
          <input
            id="remCloture"
            name="remarques"
            type="text"
            maxlength="255"
            [(ngModel)]="remarques"
            placeholder="Ex. 10 baguettes non vendues réintégrées au fournil"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Valider & Déduire du décompte' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class TourneeClotureDialogComponent implements OnInit {
  private readonly service = inject(TourneeService);

  @Input({ required: true }) tournee!: Tournee;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Tournee>();

  protected saisies: SaisieRetour[] = [];
  protected remarques = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.remarques = this.tournee.remarques ?? '';
    this.saisies = this.tournee.bilansProduits.map((b) => {
      const attendu = b.quantiteChargee;
      return {
        produitId: b.produitId,
        produitNom: b.produitNom,
        attendu,
        quantite: b.quantiteRetournee || 0,
        motif: 'INVENDU',
      };
    });
  }

  protected cloturer(): void {
    const retours: RetourPainRequest[] = this.saisies
      .filter((s) => s.quantite > 0)
      .map((s) => ({
        produitId: s.produitId,
        quantite: Math.round(s.quantite),
        motif: s.motif,
      }));
    this.enCours.set(true);
    this.erreur.set(null);
    this.service
      .cloturer(this.tournee.id, {
        retours,
        remarques: this.remarques.trim() || null,
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

