import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModePaiement, MotifRetour, RetourPainRequest, Tournee } from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { messageErreur } from '../services/message-erreur';
import { PaiementService } from '../services/paiement.service';
import { ProduitService } from '../services/produit.service';
import { SoundService } from '../services/sound.service';
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
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="cloturer()">
        <div class="dialog-header">
          <div>
            <h2>Décompte retour &amp; versement · {{ tournee.livreurNom }}</h2>
            <p class="page-sub">
              Saisissez les invendus ramenés au fournil et encaissez la recette collectée par le livreur.
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <!-- 1. TABLEAU DES RETOURS D'INVENDUS -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Pains sortis</th>
                <th class="num">Invendus ramenés</th>
                <th class="num">Pains vendus</th>
                <th>Destination des retours</th>
              </tr>
            </thead>
            <tbody>
              @for (s of saisies; track s.produitId) {
                <tr>
                  <td>
                    <strong>{{ s.produitNom }}</strong>
                    <div style="font-size: 0.75rem; color: #6B7280">{{ getPrixProduit(s.produitId) | number }} F / pain</div>
                  </td>
                  <td class="num">{{ s.attendu }}</td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      [max]="s.attendu"
                      style="width: 100px; text-align: right; font-weight: 700"
                      [name]="'ret_' + s.produitId"
                      [(ngModel)]="s.quantite"
                      (ngModelChange)="mettreAJourMontantSuggere()"
                    />
                  </td>
                  <td class="num">
                    <strong style="color: #059669; font-size: 0.95rem">
                      {{ (s.attendu - (s.quantite || 0)) | number }}
                    </strong>
                  </td>
                  <td>
                    <select [name]="'motif_' + s.produitId" [(ngModel)]="s.motif" style="font-weight: 600; font-size: 0.82rem">
                      <option value="INVENDU">Invendu intact (Réintégré au stock fournil)</option>
                      <option value="ABIME">Abîmé / Avarié (Déchet jeté)</option>
                      <option value="PERTE">Perte / Manquant non justifié</option>
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- 2. RÉCAPITULATIF FINANCIER & VERSEMENT -->
        <div
          style="
            background: #FFFBEB;
            border: 1.5px solid #FCD34D;
            border-radius: 12px;
            padding: 1rem;
            margin-top: 1rem;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem">
            <div>
              <span style="font-size: 0.8rem; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.03em">
                Recette attendue des ventes
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: #78350F; margin-top: 2px">
                {{ calculerValeurVentes() | number }} FCFA
              </div>
            </div>
            <div style="text-align: right">
              <span style="font-size: 0.8rem; color: #92400E; font-weight: 600">
                Total vendu : <strong>{{ calculerTotalPainsVendus() | number }}</strong> pains
              </span>
              <div style="font-size: 0.76rem; color: #B45309">
                (Sur {{ calculerTotalPainsCharges() | number }} pains confiés le matin)
              </div>
            </div>
          </div>

          <!-- Saisie du versement effectif -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding-top: 0.75rem; border-top: 1px dashed #FCD34D">
            <div class="field" style="margin: 0">
              <label for="montantVerse" style="font-weight: 700; color: #92400E">
                Montant versé en caisse (FCFA) *
              </label>
              <input
                id="montantVerse"
                name="montantVerse"
                type="number"
                min="0"
                required
                style="font-size: 1.1rem; font-weight: 800; color: #065F46"
                [(ngModel)]="montantVerse"
              />
            </div>

            <div class="field" style="margin: 0">
              <label for="modePaiement" style="font-weight: 700; color: #92400E">
                Mode d'encaissement *
              </label>
              <select id="modePaiement" name="modePaiement" [(ngModel)]="modePaiement" style="font-weight: 600">
                <option value="ESPECES">Espèces (Cash)</option>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="WAVE">Wave</option>
                <option value="MOOV_MONEY">Moov Money</option>
                <option value="VIREMENT">Virement bancaire</option>
              </select>
            </div>
          </div>

          <!-- Alert écart / dette éventuelle -->
          @if (montantVerse < calculerValeurVentes()) {
            <div style="margin-top: 0.75rem; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #991B1B; display: flex; align-items: center; gap: 6px">
              <span class="material-symbols-outlined" style="font-size: 1.1rem">warning</span>
              <span>
                Versement partiel : reste dû de <strong>{{ (calculerValeurVentes() - montantVerse) | number }} FCFA</strong> reporté sur la dette de {{ tournee.livreurNom }}.
              </span>
            </div>
          } @else if (montantVerse > calculerValeurVentes()) {
            <div style="margin-top: 0.75rem; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.82rem; color: #1E40AF; display: flex; align-items: center; gap: 6px">
              <span class="material-symbols-outlined" style="font-size: 1.1rem">info</span>
              <span>
                Surplus de versement : <strong>{{ (montantVerse - calculerValeurVentes()) | number }} FCFA</strong> en remboursement de dette antérieure ou avance.
              </span>
            </div>
          }
        </div>

        <div class="field" style="margin-top: 0.85rem">
          <label for="remCloture">Remarques / Observations du décompte</label>
          <input
            id="remCloture"
            name="remarques"
            type="text"
            maxlength="255"
            [(ngModel)]="remarques"
            placeholder="Ex. 20 pains invendus réintégrés, recette versée au complet"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement en cours…' : 'Valider le retour & Encaisser' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class TourneeClotureDialogComponent implements OnInit {
  private readonly tourneeService = inject(TourneeService);
  private readonly paiementService = inject(PaiementService);
  private readonly produitService = inject(ProduitService);
  private readonly soundService = inject(SoundService);

  @Input({ required: true }) tournee!: Tournee;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Tournee>();

  protected saisies: SaisieRetour[] = [];
  protected remarques = '';
  protected montantVerse = 0;
  protected modePaiement: ModePaiement = 'ESPECES';
  protected produits: Produit[] = [];
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

    this.produitService.lister().subscribe({
      next: (prods) => {
        this.produits = prods;
        this.mettreAJourMontantSuggere();
      },
      error: () => this.mettreAJourMontantSuggere(),
    });
  }

  protected getPrixProduit(produitId: number): number {
    const p = this.produits.find((x) => x.id === produitId);
    return p?.prixVente ?? 150;
  }

  protected calculerTotalPainsCharges(): number {
    return this.saisies.reduce((sum, s) => sum + (s.attendu || 0), 0);
  }

  protected calculerTotalPainsVendus(): number {
    return this.saisies.reduce(
      (sum, s) => sum + Math.max(0, s.attendu - (s.quantite || 0)),
      0,
    );
  }

  protected calculerValeurVentes(): number {
    return this.saisies.reduce((sum, s) => {
      const vendus = Math.max(0, s.attendu - (s.quantite || 0));
      return sum + vendus * this.getPrixProduit(s.produitId);
    }, 0);
  }

  protected mettreAJourMontantSuggere(): void {
    this.montantVerse = this.calculerValeurVentes();
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

    // 1. Clôturer la tournée avec déduction des retours
    this.tourneeService
      .cloturer(this.tournee.id, {
        retours,
        remarques: this.remarques.trim() || null,
      })
      .subscribe({
        next: (tourneeReponse) => {
          // 2. Si un montant a été versé, l'enregistrer directement en caisse
          if (this.montantVerse > 0) {
            const attendu = this.calculerValeurVentes();
            const tag = this.montantVerse < attendu ? 'Versement partiel' : 'Versement complet';
            const creneauInfo = this.tournee.remarques?.includes('[Matin]')
              ? 'Matin'
              : this.tournee.remarques?.includes('[Soir]')
                ? 'Soir'
                : '';
            const descTournee = creneauInfo ? `Sortie ${creneauInfo} (Tournée #${this.tournee.id})` : `Tournée #${this.tournee.id}`;
            const resteText = this.montantVerse < attendu ? ` · Reste dû : ${attendu - this.montantVerse} F` : '';

            this.paiementService
              .creer({
                tourneeId: this.tournee.id,
                montant: this.montantVerse,
                modePaiement: this.modePaiement,
                remarques: `${tag} - ${this.tournee.livreurNom} (${descTournee}${resteText})`,
              })
              .subscribe({
                next: () => {
                  this.enCours.set(false);
                  this.soundService.jouerSonCaisse();
                  this.enregistre.emit(tourneeReponse);
                },
                error: (err) => {
                  // Même si le paiement échoue, la clôture est faite
                  this.enCours.set(false);
                  this.soundService.jouerSonSucces();
                  this.enregistre.emit(tourneeReponse);
                },
              });
          } else {
            this.enCours.set(false);
            this.soundService.jouerSonSucces();
            this.enregistre.emit(tourneeReponse);
          }
        },
        error: (err) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }
}

