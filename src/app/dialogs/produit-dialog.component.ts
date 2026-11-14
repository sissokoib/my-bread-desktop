import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Produit } from '../models/produit.model';
import { messageErreur } from '../services/message-erreur';
import { ProduitService } from '../services/produit.service';

@Component({
  selector: 'app-produit-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>{{ produit ? 'Modifier le produit' : 'Nouveau produit' }}</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="nomProduit">Nom du produit</label>
          <input
            id="nomProduit"
            name="nom"
            type="text"
            required
            maxlength="100"
            [(ngModel)]="nom"
            placeholder="Ex. Baguette, Pain 250 F, Pain de mie…"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="prixVente">Prix de vente standard (FCFA)</label>
            <input
              id="prixVente"
              name="prixVente"
              type="number"
              min="0"
              step="5"
              required
              [(ngModel)]="prixVente"
            />
          </div>

          <div class="field">
            <label for="coutRevient">Coût de revient (FCFA)</label>
            <input
              id="coutRevient"
              name="coutRevient"
              type="number"
              min="0"
              step="5"
              [(ngModel)]="coutRevient"
            />
            <span class="field-hint">Sert à calculer la marge. Laissez 0 si inconnu.</span>
          </div>
        </div>

        <label class="checkbox-line">
          <input type="checkbox" name="actif" [(ngModel)]="actif" />
          Produit actif (proposé dans les fournées et les livraisons)
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
  protected prixVente: number | null = 250;
  protected coutRevient: number | null = 0;
  protected actif = true;
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    if (this.produit) {
      this.nom = this.produit.nom;
      this.prixVente = this.produit.prixVente;
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
        this.enCours.set(false);
        this.enregistre.emit(resultat);
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}

