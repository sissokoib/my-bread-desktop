import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Produit, enregistrerPrixLivreur, obtenirPrixLivreur } from '../models/produit.model';
import { messageErreur } from '../services/message-erreur';
import { ProduitService } from '../services/produit.service';

@Component({
  selector: 'app-produit-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" style="max-width: 560px; width: 95%" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>{{ produit ? 'Modifier le produit' : 'Nouveau produit' }}</h2>
            <p class="page-sub">Définissez le prix de vente à la caisse, le tarif livreur et le coût de revient.</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="nomProduit">Nom du produit *</label>
          <input
            id="nomProduit"
            name="nom"
            type="text"
            required
            maxlength="100"
            [(ngModel)]="nom"
            placeholder="Ex. Baguette, Gros pain, Pain de mie…"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="prixVente">Prix Caisse / Client (FCFA) *</label>
            <input
              id="prixVente"
              name="prixVente"
              type="number"
              min="0"
              step="5"
              required
              [(ngModel)]="prixVente"
            />
            <span class="field-hint">Prix vendu directement aux clients à la caisse.</span>
          </div>

          <div class="field">
            <label for="prixLivreur">Prix Livreur / Gros (FCFA)</label>
            <input
              id="prixLivreur"
              name="prixLivreur"
              type="number"
              min="0"
              step="5"
              [(ngModel)]="prixLivreur"
            />
            <span class="field-hint">Tarif facturé au livreur lors des tournées.</span>
          </div>
        </div>

        <div class="field">
          <label for="coutRevient">Coût de revient au fournil (FCFA)</label>
          <input
            id="coutRevient"
            name="coutRevient"
            type="number"
            min="0"
            step="5"
            [(ngModel)]="coutRevient"
          />
          <span class="field-hint">Coût de fabrication unitaire (farine, levure, énergie).</span>
        </div>

        <!-- Récapitulatif automatique des marges -->
        <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px; padding: 0.65rem 0.9rem; margin-bottom: 0.85rem; font-size: 0.8rem; color: #78350F; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem">
          <span>
            Marge Caisse :
            <strong style="color: #059669">{{ ((prixVente || 0) - (coutRevient || 0)) | number }} F / pain</strong>
          </span>
          <span>
            Commission Livreur :
            <strong style="color: #1D4ED8">{{ ((prixVente || 0) - (prixLivreur ?? prixVente ?? 0)) | number }} F / pain</strong>
          </span>
        </div>

        <label class="checkbox-line">
          <input type="checkbox" name="actif" [(ngModel)]="actif" />
          Produit actif (proposé dans les fournées, ventes caisse et livraisons)
        </label>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ProduitDialogComponent implements OnInit {
  private readonly service = inject(ProduitService);

  @Input() produit: Produit | null = null;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Produit>();

  protected nom = '';
  protected prixVente: number | null = 150;
  protected prixLivreur: number | null = 135;
  protected coutRevient: number | null = 0;
  protected actif = true;
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    if (this.produit) {
      this.nom = this.produit.nom;
      this.prixVente = this.produit.prixVente;
      this.prixLivreur = obtenirPrixLivreur(this.produit.id, this.produit.prixVente);
      this.coutRevient = this.produit.coutRevient;
      this.actif = this.produit.actif;
    }
  }

  protected enregistrer(): void {
    const nom = this.nom.trim();
    if (!nom || this.prixVente === null || this.prixVente < 0) {
      this.erreur.set('Indiquez un nom et un prix de vente valide.');
      return;
    }
    const payload = {
      nom,
      prixVente: Math.round(this.prixVente),
      coutRevient: this.coutRevient === null ? 0 : Math.round(this.coutRevient),
      actif: this.actif,
    };
    this.enCours.set(true);
    this.erreur.set(null);
    const requete = this.produit
      ? this.service.modifier(this.produit.id, payload)
      : this.service.creer(payload);
    requete.subscribe({
      next: (resultat) => {
        const tarifLivreur =
          this.prixLivreur !== null && this.prixLivreur >= 0
            ? Math.round(this.prixLivreur)
            : Math.round(this.prixVente!);
        enregistrerPrixLivreur(resultat.id, tarifLivreur);
        this.enCours.set(false);
        this.enregistre.emit({ ...resultat, prixLivreur: tarifLivreur });
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}
