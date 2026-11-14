import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbsenceCreationRequest, AbsenceEmploye, Utilisateur } from '../models/utilisateur.model';
import { messageErreur } from '../services/message-erreur';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-absence-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <div class="dialog" style="max-width: 580px; width: 95%" (click)="$event.stopPropagation()">
        <!-- En-tête sobre et cohérent avec l'identité My Bread -->
        <div class="dialog-header" style="margin-bottom: 0.85rem">
          <div>
            <h2>Noter une absence de garde</h2>
            <p class="page-sub" style="margin-top: 0.2rem">
              {{ employe.nom }} · {{ employe.poste || 'Employé' }}
              @if (employe.quartier) { · {{ employe.quartier }} }
            </p>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error" style="margin-bottom: 0.75rem; padding: 0.5rem 0.85rem">
            {{ erreur() }}
          </div>
        }

        <!-- Bandeau discret de déduction automatique calculée selon le salaire -->
        <div class="absence-info-bar">
          <div class="info-left">
            <span class="info-label">Retenue automatique sur salaire :</span>
            <strong class="info-amount">-{{ deductionAutomatique() | number }} FCFA</strong>
          </div>
          <span class="info-hint">
            1 jour sur {{ employe.frequencePaie === 'MENSUEL' ? '30 jours' : '15 jours' }} ({{ (employe.salaireBase || 0) | number }} F)
          </span>
        </div>

        <!-- Formulaire compact d'enregistrement -->
        <form (ngSubmit)="enregistrerAbsence()" class="absence-form">
          <div class="form-grid" style="gap: 0.75rem; margin-bottom: 0.75rem">
            <div class="field" style="margin-bottom: 0">
              <label for="dateAbs">Date de la garde *</label>
              <input
                id="dateAbs"
                name="dateAbsence"
                type="date"
                required
                [(ngModel)]="dateAbsence"
              />
            </div>

            <div class="field" style="margin-bottom: 0">
              <label for="typeGarde">Quart de garde *</label>
              <select id="typeGarde" name="typeGarde" [(ngModel)]="typeGarde">
                <option value="Garde de jour">Garde de jour</option>
                <option value="Garde de nuit">Garde de nuit (Fournil)</option>
                <option value="Tournée matinale">Tournée matinale</option>
                <option value="Service complet">Service complet</option>
              </select>
            </div>
          </div>

          <div class="form-grid" style="gap: 0.75rem; align-items: flex-end; margin-bottom: 1.15rem">
            <div class="field" style="margin-bottom: 0">
              <label for="motifAbs">Motif / Justification</label>
              <input
                id="motifAbs"
                name="motif"
                type="text"
                maxlength="255"
                [(ngModel)]="motif"
                placeholder="Ex. Absence non justifiée, maladie, relève..."
              />
            </div>

            <button
              type="submit"
              class="btn-primary"
              [disabled]="enCours()"
              style="height: 42px; min-width: 110px; justify-content: center"
            >
              {{ enCours() ? 'En cours…' : 'Valider' }}
            </button>
          </div>
        </form>

        <!-- Section Historique des absences enregistrées -->
        <div class="history-header">
          <span class="history-title">Historique des absences ({{ absences().length }})</span>
          @if (totalDeduit() > 0) {
            <span class="history-total">
              Cumul déduit : <strong>-{{ totalDeduit() | number }} FCFA</strong>
            </span>
          }
        </div>

        <div class="table-wrap history-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Quart de travail</th>
                <th>Motif</th>
                <th class="num">Déduction</th>
                <th style="width: 50px; text-align: right">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (a of absences(); track a.id) {
                <tr>
                  <td>
                    <strong style="color: var(--text-primary)">{{ a.dateAbsence }}</strong>
                  </td>
                  <td>{{ a.typeGarde }}</td>
                  <td style="color: var(--text-secondary); font-size: 0.78rem">
                    {{ a.motif || '—' }}
                  </td>
                  <td class="num" style="color: #DC2626; font-weight: 700">
                    -{{ a.montantDeduit | number }} F
                  </td>
                  <td style="text-align: right">
                    <button
                      type="button"
                      class="btn-danger btn-sm"
                      style="padding: 0.18rem 0.45rem; font-size: 0.7rem"
                      (click)="supprimerAbsence(a)"
                      title="Annuler cette absence"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty" style="padding: 1rem">
                    Aucune absence enregistrée pour cet employé.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .absence-info-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem;
        background: #FFFBEB;
        border: 1px solid #FCD34D;
        border-radius: var(--radius-sm, 10px);
        padding: 0.55rem 0.85rem;
        margin-bottom: 0.85rem;
      }

      .info-left {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }

      .info-label {
        font-size: 0.8rem;
        color: #78350F;
        font-weight: 600;
      }

      .info-amount {
        font-size: 0.92rem;
        color: #B45309;
        font-weight: 800;
      }

      .info-hint {
        font-size: 0.74rem;
        color: #92400E;
      }

      .history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.45rem;
        padding: 0 0.2rem;
      }

      .history-title {
        font-size: 0.84rem;
        font-weight: 750;
        color: var(--text-primary);
      }

      .history-total {
        font-size: 0.78rem;
        color: #DC2626;
      }

      .history-table-scroll {
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm, 10px);
      }

      .history-table-scroll table {
        margin: 0;
      }

      .history-table-scroll th {
        font-size: 0.74rem;
        padding: 0.45rem 0.65rem;
        background: var(--surface-hover, #F7F3EE);
      }

      .history-table-scroll td {
        font-size: 0.78rem;
        padding: 0.4rem 0.65rem;
      }
    `,
  ],
})
export class AbsenceDialogComponent implements OnInit {
  private readonly service = inject(UtilisateurService);

  @Input({ required: true }) employe!: Utilisateur;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly actualiser = new EventEmitter<void>();

  protected readonly absences = signal<AbsenceEmploye[]>([]);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected dateAbsence = new Date().toISOString().slice(0, 10);
  protected typeGarde = 'Garde de jour';
  protected motif = '';

  protected readonly totalDeduit = computed(() =>
    this.absences().reduce((sum, a) => sum + (a.montantDeduit || 0), 0),
  );

  protected deductionAutomatique(): number {
    const base = this.employe.salaireBase || 0;
    const jours = this.employe.frequencePaie === 'MENSUEL' ? 30 : 15;
    return Math.round(base / jours);
  }

  ngOnInit(): void {
    this.chargerAbsences();
  }

  protected chargerAbsences(): void {
    this.service.listerAbsences(this.employe.id).subscribe({
      next: (liste) => this.absences.set(liste),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected enregistrerAbsence(): void {
    if (!this.dateAbsence) {
      this.erreur.set('Veuillez sélectionner la date.');
      return;
    }

    const req: AbsenceCreationRequest = {
      dateAbsence: this.dateAbsence,
      typeGarde: this.typeGarde,
      motif: this.motif.trim() || undefined,
      montantDeduit: this.deductionAutomatique(),
    };

    this.enCours.set(true);
    this.erreur.set(null);

    this.service.enregistrerAbsence(this.employe.id, req).subscribe({
      next: () => {
        this.enCours.set(false);
        this.motif = '';
        this.chargerAbsences();
        this.actualiser.emit();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected supprimerAbsence(a: AbsenceEmploye): void {
    if (!confirm(`Annuler l'absence du ${a.dateAbsence} (${a.montantDeduit} FCFA) ?`)) return;

    this.service.supprimerAbsence(a.id).subscribe({
      next: () => {
        this.chargerAbsences();
        this.actualiser.emit();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
