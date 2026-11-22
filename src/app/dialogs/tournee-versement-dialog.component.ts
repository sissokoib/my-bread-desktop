import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModePaiement, Tournee } from '../models/operations.model';
import { messageErreur } from '../services/message-erreur';
import { PaiementService } from '../services/paiement.service';
import { SoundService } from '../services/sound.service';

@Component({
  selector: 'app-tournee-versement-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" style="max-width: 520px" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>Encaisser un versement de tournée</h2>
            <p class="page-sub">
              Rattachez ce paiement à la sortie de {{ tournee.livreurNom }} (Tournée #{{ tournee.id }}).
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <!-- FICHE RÉCAPITULATIVE DE LA TOURNÉE CIBLE -->
        <div
          style="
            background: #FFFBEB;
            border: 1.5px solid #FCD34D;
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1.15rem;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem">
            <div style="font-weight: 800; color: #78350F; font-size: 0.95rem">
              Tournée #{{ tournee.id }} · {{ tournee.livreurNom }}
            </div>
            <span
              class="badge"
              [class.badge-ok]="tournee.statut === 'CLOTUREE'"
              [class.badge-warn]="tournee.statut !== 'CLOTUREE'"
              style="font-size: 0.72rem"
            >
              {{ tournee.statut === 'CLOTUREE' ? 'Mission clôturée' : 'En vente' }}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; font-size: 0.85rem">
            <div>
              <span style="color: #92400E">Valeur des ventes :</span>
              <div style="font-weight: 700; color: #1F2937">{{ tournee.totalVentes | number }} FCFA</div>
            </div>
            <div>
              <span style="color: #92400E">Déjà versé en caisse :</span>
              <div style="font-weight: 700; color: #059669">{{ tournee.totalEncaisse | number }} FCFA</div>
            </div>
          </div>

          <div style="margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px dashed #FCD34D; display: flex; justify-content: space-between; align-items: center">
            <span style="font-weight: 700; color: #92400E; font-size: 0.88rem">Reste à encaisser :</span>
            <strong style="color: #DC2626; font-size: 1.05rem">
              {{ resteDu() | number }} FCFA
            </strong>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="montantVerser">Montant versé (FCFA) *</label>
            <input
              id="montantVerser"
              name="montant"
              type="number"
              min="1"
              required
              style="font-size: 1.1rem; font-weight: 800; color: #065F46"
              [(ngModel)]="montant"
            />
            <div class="field-hint">
              Saisissez la totalité ou le montant partiel apporté par le livreur.
            </div>
          </div>

          <div class="field">
            <label for="modePaie">Mode de versement *</label>
            <select id="modePaie" name="modePaiement" [(ngModel)]="modePaiement" style="font-weight: 600">
              <option value="ESPECES">Espèces (Tiroir-caisse)</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="WAVE">Wave</option>
              <option value="MOOV_MONEY">Moov Money</option>
              <option value="VIREMENT">Virement bancaire</option>
            </select>
          </div>
        </div>

        <div class="field" style="margin-top: 0.5rem">
          <label for="notePaie">Motif / Commentaire du versement</label>
          <input
            id="notePaie"
            name="remarques"
            type="text"
            [(ngModel)]="remarques"
            placeholder="Ex. Versement partiel des boutiquiers ou solde complet tournée"
          />
        </div>

        @if (montant < resteDu() && montant > 0) {
          <div style="margin-top: 0.75rem; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #991B1B">
            ⚠️ <strong>Versement partiel</strong> : Il restera encore <strong>{{ (resteDu() - montant) | number }} FCFA</strong> à recouvrer pour cette tournée.
          </div>
        } @else if (montant >= resteDu() && resteDu() > 0) {
          <div style="margin-top: 0.75rem; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #065F46">
            ✅ <strong>Solde complet</strong> : Cette tournée sera intégralement réglée et à jour.
          </div>
        }

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours() || montant <= 0">
            {{ enCours() ? 'Enregistrement…' : 'Encaisser & Créditer la Caisse' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class TourneeVersementDialogComponent implements OnInit {
  private readonly paiementService = inject(PaiementService);
  private readonly soundService = inject(SoundService);

  @Input({ required: true }) tournee!: Tournee;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<void>();

  protected montant = 0;
  protected modePaiement: ModePaiement = 'ESPECES';
  protected remarques = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected resteDu(): number {
    return Math.max(0, this.tournee.totalVentes - this.tournee.totalEncaisse);
  }

  ngOnInit(): void {
    const reste = this.resteDu();
    this.montant = reste > 0 ? reste : this.tournee.totalVentes;
    this.remarques = `Versement tournée #${this.tournee.id} - ${this.tournee.livreurNom}`;
  }

  protected enregistrer(): void {
    if (this.montant <= 0) {
      this.erreur.set('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    this.paiementService
      .creer({
        tourneeId: this.tournee.id,
        montant: this.montant,
        modePaiement: this.modePaiement,
        remarques: this.remarques.trim() || `Versement tournée #${this.tournee.id}`,
      })
      .subscribe({
        next: () => {
          this.enCours.set(false);
          this.soundService.jouerSonCaisse();
          this.enregistre.emit();
        },
        error: (err) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }
}
