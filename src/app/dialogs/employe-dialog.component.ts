import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Utilisateur, UtilisateurCreation } from '../models/utilisateur.model';
import { messageErreur } from '../services/message-erreur';
import { UtilisateurService } from '../services/utilisateur.service';

/** Type d'employé : employé direct de la boulangerie ou livreur (prestataire externe). */
export type TypeEmploye = 'DIRECT' | 'LIVREUR';

@Component({
  selector: 'app-employe-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" style="max-width: 600px; width: 95%" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>{{ typeEmploye === 'LIVREUR' ? 'Nouveau livreur' : 'Nouvel employé' }}</h2>
            <p class="page-sub">
              @if (typeEmploye === 'LIVREUR') {
                Le livreur n'est pas un employé direct : il n'a ni salaire, ni ration, ni accès à l'application.
              } @else {
                Renseignez les coordonnées et la rémunération de l'employé.
              }
            </p>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <!-- TYPE D'EMPLOYÉ -->
        <div class="field">
          <label>Type d'employé *</label>
          <div class="type-grid">
            <button
              type="button"
              class="type-card"
              [class.active]="typeEmploye === 'DIRECT'"
              (click)="typeEmploye = 'DIRECT'"
            >
              <span class="material-symbols-outlined">badge</span>
              <span>
                <strong>Employé direct</strong>
                <small>Personnel de la boulangerie (fournil, caisse…)</small>
              </span>
            </button>
            <button
              type="button"
              class="type-card"
              [class.active]="typeEmploye === 'LIVREUR'"
              (click)="typeEmploye = 'LIVREUR'"
            >
              <span class="material-symbols-outlined">local_shipping</span>
              <span>
                <strong>Livreur</strong>
                <small>Prestataire externe qui vend le pain en ville</small>
              </span>
            </button>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="empNom">Nom complet *</label>
            <input
              id="empNom"
              name="nom"
              type="text"
              required
              [(ngModel)]="form.nom"
              placeholder="Ex: Salif Coulibaly"
            />
          </div>

          <div class="field">
            <label for="empTel">Téléphone *</label>
            <input
              id="empTel"
              name="telephone"
              type="tel"
              required
              [(ngModel)]="form.telephone"
              placeholder="Ex: 75 12 34 56"
            />
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="empQuartier">Quartier de résidence *</label>
            <input
              id="empQuartier"
              name="quartier"
              type="text"
              required
              [(ngModel)]="form.quartier"
              placeholder="Ex: Kalaban Coura, Badalabougou"
            />
          </div>

          @if (typeEmploye === 'DIRECT') {
            <div class="field">
              <label for="empFreq">Mode de rémunération *</label>
              <select id="empFreq" name="frequencePaie" [(ngModel)]="form.frequencePaie">
                <option value="QUINZAINE">Par quinzaine (15 jours)</option>
                <option value="MENSUEL">Mensuel (30 jours)</option>
              </select>
            </div>
          }
        </div>

        @if (typeEmploye === 'DIRECT') {
          <div class="form-grid">
            <div class="field">
              <label for="empSalaire">Salaire de base (FCFA) *</label>
              <input
                id="empSalaire"
                name="salaireBase"
                type="number"
                min="0"
                step="500"
                required
                [(ngModel)]="form.salaireBase"
                placeholder="Ex: 75000"
              />
            </div>

            <div class="field">
              <label for="empRation">Ration journalière repas (FCFA)</label>
              <input
                id="empRation"
                name="rationJournaliere"
                type="number"
                min="0"
                step="100"
                [(ngModel)]="form.rationJournaliere"
                placeholder="Ex: 1000"
              />
            </div>
          </div>

          <!-- Note discrète de calcul de retenue -->
          @if (form.salaireBase && form.salaireBase > 0) {
            <div class="rule-hint-box">
              <span>Retenue calculée par garde manquée :</span>
              <strong style="color: #B45309">
                {{ calculDeductionJournaliere() | number }} FCFA / jour
              </strong>
              <span style="font-size: 0.74rem; color: #78350F">
                ({{ form.salaireBase | number }} F ÷ {{ form.frequencePaie === 'MENSUEL' ? '30 j' : '15 j' }})
              </span>
            </div>
          }
        } @else {
          <div class="rule-hint-box" style="background: #EFF6FF; border-color: #BFDBFE; color: #1E3A8A">
            <span class="material-symbols-outlined" style="font-size: 1rem">info</span>
            <span>Le livreur apparaîtra dans la liste des sorties (tournées) et des versements en caisse.</span>
          </div>
        }

        <div class="dialog-footer">
          <button type="button" class="btn-ghost" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .rule-hint-box {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        background: #FFFBEB;
        border: 1px solid #FCD34D;
        border-radius: var(--radius-sm, 10px);
        padding: 0.5rem 0.85rem;
        font-size: 0.8rem;
        color: #78350F;
        margin-bottom: 1.15rem;
      }
      .type-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .type-card {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        text-align: left;
        padding: 0.7rem 0.85rem;
        border: 2px solid #E5E7EB;
        border-radius: 12px;
        background: #FFFFFF;
        cursor: pointer;
        color: #374151;
        transition: all 0.15s ease;
      }
      .type-card .material-symbols-outlined {
        font-size: 1.3rem;
        color: #9CA3AF;
        margin-top: 2px;
      }
      .type-card strong {
        display: block;
        font-size: 0.88rem;
        color: #1F2937;
      }
      .type-card small {
        display: block;
        font-size: 0.74rem;
        color: #6B7280;
        line-height: 1.3;
        margin-top: 2px;
      }
      .type-card.active {
        border-color: #8B5A2B;
        background: #FDF8F3;
      }
      .type-card.active .material-symbols-outlined {
        color: #8B5A2B;
      }
      @media (max-width: 520px) {
        .type-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class EmployeDialogComponent {
  private readonly service = inject(UtilisateurService);

  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Utilisateur>();

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected typeEmploye: TypeEmploye = 'DIRECT';

  protected form: UtilisateurCreation = {
    nom: '',
    telephone: '',
    quartier: '',
    poste: 'Employé',
    role: 'EMPLOYE',
    frequencePaie: 'QUINZAINE',
    salaireBase: 75000,
    rationJournaliere: 1000,
    motDePasse: 'pass1234',
  };

  protected calculDeductionJournaliere(): number {
    const base = this.form.salaireBase || 0;
    const jours = this.form.frequencePaie === 'MENSUEL' ? 30 : 15;
    return Math.round(base / jours);
  }

  protected enregistrer(): void {
    if (!this.form.nom.trim() || !this.form.telephone.trim()) {
      this.erreur.set('Veuillez renseigner le nom et le numéro de téléphone.');
      return;
    }

    const estLivreur = this.typeEmploye === 'LIVREUR';
    const requete: UtilisateurCreation = estLivreur
      ? {
          ...this.form,
          role: 'LIVREUR',
          poste: 'Livreur',
          frequencePaie: undefined,
          salaireBase: 0,
          rationJournaliere: 0,
        }
      : { ...this.form, role: 'EMPLOYE', poste: this.form.poste || 'Employé' };

    this.enCours.set(true);
    this.erreur.set(null);

    this.service.creer(requete).subscribe({
      next: (cree) => {
        this.enCours.set(false);
        this.enregistre.emit(cree);
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}
