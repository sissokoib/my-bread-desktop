import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Client } from '../models/client.model';
import { Livraison, ModePaiement, Tournee } from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { LivraisonService } from '../services/livraison.service';
import { messageErreur } from '../services/message-erreur';

@Component({
  selector: 'app-livraison-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>Enregistrer une livraison</h2>
            <p class="page-sub">Tournée de {{ tournee.livreurNom }} ({{ tournee.dateTournee }})</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="clientLivr">Client / Destinataire *</label>
          <select id="clientLivr" name="clientId" required [(ngModel)]="clientId">
            <option [ngValue]="null">— Sélectionner un client —</option>
            @for (c of clients; track c.id) {
              <option [ngValue]="c.id">
                {{ c.nomBoutique }} {{ c.zoneNom ? '· ' + c.zoneNom : '' }} ({{ c.telephone }})
              </option>
            }
          </select>
          <span class="field-hint">
            Les tarifs négociés du client sont appliqués automatiquement par le serveur.
          </span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Restant sur la tournée</th>
                <th class="num">Quantité livrée</th>
              </tr>
            </thead>
            <tbody>
              @for (b of tournee.bilansProduits; track b.produitId) {
                <tr>
                  <td>
                    <strong>{{ b.produitNom }}</strong>
                  </td>
                  <td class="num">{{ b.ecart }}</td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      style="width: 115px"
                      [name]="'livr_' + b.produitId"
                      [(ngModel)]="quantites[b.produitId]"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="montantPaye">Montant payé sur place (FCFA)</label>
            <input
              id="montantPaye"
              name="montantPaye"
              type="number"
              min="0"
              step="50"
              [(ngModel)]="montantPaye"
              placeholder="0 si livraison à crédit"
            />
          </div>

          <div class="field">
            <label>Mode de paiement</label>
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

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Valider la livraison' }}
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
export class LivraisonDialogComponent implements OnInit {
  private readonly service = inject(LivraisonService);

  @Input({ required: true }) tournee!: Tournee;
  @Input({ required: true }) clients!: Client[];
  @Input() produits: Produit[] = [];
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Livraison>();

  protected clientId: number | null = null;
  protected quantites: Record<number, number> = {};
  protected montantPaye: number | null = 0;
  protected modePaiement: ModePaiement = 'ESPECES';
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
    if (this.clients.length > 0) {
      this.clientId = this.clients[0].id;
    }
    for (const b of this.tournee.bilansProduits) {
      this.quantites[b.produitId] = 0;
    }
  }

  protected enregistrer(): void {
    if (!this.clientId) {
      this.erreur.set('Veuillez choisir un client.');
      return;
    }
    const lignes = Object.entries(this.quantites)
      .map(([id, qte]) => ({ produitId: Number(id), quantite: Math.round(qte || 0) }))
      .filter((l) => l.quantite > 0);
    if (lignes.length === 0) {
      this.erreur.set('Saisissez une quantité livrée positive pour au moins un produit.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service
      .creer({
        tourneeId: this.tournee.id,
        clientId: this.clientId,
        lignes,
        montantPaye: this.montantPaye && this.montantPaye > 0 ? Math.round(this.montantPaye) : 0,
        modePaiement: this.modePaiement,
        remarques: null,
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

