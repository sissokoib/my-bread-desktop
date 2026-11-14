import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategorieDepense, Depense } from '../models/operations.model';
import { DepenseService } from '../services/depense.service';
import { messageErreur } from '../services/message-erreur';

@Component({
  selector: 'app-depense-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>Nouvelle dépense</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="dateDep">Date</label>
            <input id="dateDep" name="dateDepense" type="date" required [(ngModel)]="dateDepense" />
          </div>

          <div class="field">
            <label for="catDep">Catégorie</label>
            <select id="catDep" name="categorie" [(ngModel)]="categorie">
              <option value="FARINE">Farine</option>
              <option value="LEVURE_INTRANTS">Levure, sel, améliorant</option>
              <option value="BOIS_GAZ">Bois / gaz / four</option>
              <option value="ELECTRICITE_EAU">Électricité et eau</option>
              <option value="SALAIRE">Salaires et primes</option>
              <option value="TRANSPORT">Carburant et transport</option>
              <option value="ENTRETIEN">Entretien et réparations</option>
              <option value="AUTRE">Autre dépense</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="montantDep">Montant (FCFA) *</label>
          <input
            id="montantDep"
            name="montant"
            type="number"
            min="5"
            step="100"
            required
            [(ngModel)]="montant"
          />
        </div>

        <div class="field">
          <label for="libDep">Description *</label>
          <input
            id="libDep"
            name="libelle"
            type="text"
            required
            maxlength="200"
            [(ngModel)]="libelle"
            placeholder="Ex. Achat de 10 sacs de farine"
          />
        </div>

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
export class DepenseDialogComponent implements OnInit {
  private readonly service = inject(DepenseService);

  @Input() dateParDefaut = '';
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Depense>();

  protected dateDepense = '';
  protected categorie: CategorieDepense = 'FARINE';
  protected montant: number | null = null;
  protected libelle = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.dateDepense = this.dateParDefaut || new Date().toISOString().slice(0, 10);
  }

  protected enregistrer(): void {
    const libelle = this.libelle.trim();
    if (!libelle || !this.montant || this.montant <= 0) {
      this.erreur.set('Indiquez une description et un montant positif.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service
      .creer({
        dateDepense: this.dateDepense,
        categorie: this.categorie,
        montant: Math.round(this.montant),
        libelle,
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

