import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientSolde, ModePaiement, Paiement } from '../models/operations.model';
import { messageErreur } from '../services/message-erreur';
import { PaiementService } from '../services/paiement.service';

@Component({
  selector: 'app-paiement-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>Encaisser un paiement</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="clientPaie">Boutiquier *</label>
          <select id="clientPaie" name="clientId" required [(ngModel)]="clientId">
            <option [ngValue]="null">— Sélectionner un boutiquier —</option>
            @for (s of soldes; track s.clientId) {
              <option [ngValue]="s.clientId">
                {{ s.nomBoutique }} (dette : {{ s.solde | number }} FCFA)
              </option>
            }
          </select>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="montantEnc">Montant encaissé (FCFA) *</label>
            <input
              id="montantEnc"
              name="montant"
              type="number"
              min="5"
              step="50"
              required
              [(ngModel)]="montant"
            />
          </div>

          <div class="field">
            <label>Mode de paiement *</label>
            <div class="custom-payment-select" (click)="dropdownOuvert.set(!dropdownOuvert())">
              <div class="selected-payment-display">
                <img [src]="getLogoMode(modePaiement)" [alt]="modePaiement" class="payment-logo-icon" />
                <span class="selected-payment-text">{{ getNomMode(modePaiement) }}</span>
                <span class="dropdown-chevron" [class.is-rotated]="dropdownOuvert()">▼</span>
              </div>

              @if (dropdownOuvert()) {
                <div class="payment-options-menu" (click)="$event.stopPropagation()">
                  @for (opt of optionsModes; track opt.valeur) {
                    <div
                      class="payment-option-item"
                      [class.is-selected]="modePaiement === opt.valeur"
                      (click)="modePaiement = opt.valeur; dropdownOuvert.set(false)"
                    >
                      <div class="payment-option-left">
                        <img [src]="opt.logo" [alt]="opt.nom" class="payment-logo-icon" />
                        <span class="payment-option-label">{{ opt.nom }}</span>
                      </div>
                      @if (modePaiement === opt.valeur) {
                        <span class="payment-check">✓</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <div class="field">
          <label for="remEnc">Note / référence</label>
          <input
            id="remEnc"
            name="remarques"
            type="text"
            maxlength="255"
            [(ngModel)]="remarques"
            placeholder="Ex. Règlement dette semaine"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer le paiement' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .custom-payment-select {
        position: relative;
        user-select: none;
      }
      .selected-payment-display {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.5rem 0.85rem;
        background: #FFFFFF;
        border: 1px solid #D1D5DB;
        border-radius: 8px;
        cursor: pointer;
      }
      .selected-payment-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: #1F2937;
        flex: 1;
      }
      .dropdown-chevron {
        font-size: 0.65rem;
        color: #6B7280;
        transition: transform 0.2s ease;
      }
      .dropdown-chevron.is-rotated {
        transform: rotate(180deg);
      }
      .payment-options-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: #FFFFFF;
        border: 1px solid #E5E7EB;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
        z-index: 100;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .payment-option-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.7rem;
        border-radius: 6px;
        cursor: pointer;
      }
      .payment-option-item:hover {
        background: #F3F4F6;
      }
      .payment-option-item.is-selected {
        background: #FFF7ED;
        border: 1px solid #FED7AA;
      }
      .payment-option-left {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .payment-logo-icon {
        width: 22px;
        height: 22px;
        object-fit: contain;
        border-radius: 4px;
        flex-shrink: 0;
      }
      .payment-option-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #1F2937;
      }
      .payment-check {
        color: #EA580C;
        font-weight: 800;
      }
    `,
  ],
})
export class PaiementDialogComponent implements OnInit {
  private readonly service = inject(PaiementService);

  @Input({ required: true }) soldes!: ClientSolde[];
  @Input() clientPreselectionne: ClientSolde | null = null;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Paiement>();

  protected clientId: number | null = null;
  protected montant: number | null = null;
  protected modePaiement: ModePaiement = 'ESPECES';
  protected remarques = '';
  protected readonly dropdownOuvert = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly optionsModes = [
    { valeur: 'ESPECES' as ModePaiement, nom: 'Espèces (Cash)', logo: 'images/paiements/especes.svg' },
    { valeur: 'WAVE' as ModePaiement, nom: 'Wave', logo: 'images/paiements/wave.png' },
    { valeur: 'ORANGE_MONEY' as ModePaiement, nom: 'Orange Money', logo: 'images/paiements/orange-money.png' },
    { valeur: 'MOOV_MONEY' as ModePaiement, nom: 'Moov Money', logo: 'images/paiements/moov-money.png' },
    { valeur: 'VIREMENT' as ModePaiement, nom: 'Virement bancaire', logo: 'images/paiements/virement.svg' },
  ];

  protected getLogoMode(mode: ModePaiement): string {
    const opt = this.optionsModes.find((o) => o.valeur === mode);
    return opt ? opt.logo : 'images/paiements/especes.svg';
  }

  protected getNomMode(mode: ModePaiement): string {
    const opt = this.optionsModes.find((o) => o.valeur === mode);
    return opt ? opt.nom : mode;
  }

  ngOnInit(): void {
    if (this.clientPreselectionne) {
      this.clientId = this.clientPreselectionne.clientId;
      this.montant = Math.max(0, this.clientPreselectionne.solde) || null;
    } else if (this.soldes.length > 0) {
      this.clientId = this.soldes[0].clientId;
    }
  }

  protected enregistrer(): void {
    if (!this.clientId || !this.montant || this.montant <= 0) {
      this.erreur.set('Sélectionnez un boutiquier et indiquez un montant positif.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service
      .creer({
        clientId: this.clientId,
        montant: Math.round(this.montant),
        modePaiement: this.modePaiement,
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

