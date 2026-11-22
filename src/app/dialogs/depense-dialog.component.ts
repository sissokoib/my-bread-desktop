import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CategorieDepense, Depense } from '../models/operations.model';
import { AbsenceEmploye, Utilisateur } from '../models/utilisateur.model';
import { DepenseService } from '../services/depense.service';
import { messageErreur } from '../services/message-erreur';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-depense-dialog',
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <div>
            <h2>Nouvelle dépense & charge</h2>
            <p class="dialog-subtitle">Enregistrement d'une sortie de caisse</p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="dateDep">Date d'opération *</label>
            <input
              id="dateDep"
              name="dateDepense"
              type="date"
              required
              [(ngModel)]="dateDepense"
              (ngModelChange)="surChangementDate()"
            />
          </div>

          <div class="field">
            <label for="catDep">Catégorie de charge *</label>
            <select
              id="catDep"
              name="categorie"
              [(ngModel)]="categorie"
              (ngModelChange)="surChangementCategorie($event)"
            >
              <option value="FARINE">Farine (Matière première)</option>
              <option value="LEVURE_INTRANTS">Levure, sel, améliorant</option>
              <option value="BOIS_GAZ">Bois / gaz / fournil</option>
              <option value="ELECTRICITE_EAU">Électricité et eau</option>
              <option value="SALAIRE">Salaires, primes & rations</option>
              <option value="TRANSPORT">Carburant et transport</option>
              <option value="ENTRETIEN">Entretien et réparations</option>
              <option value="AUTRE">Autre charge d'exploitation</option>
            </select>
          </div>
        </div>

        <!-- BLOC SPÉCIFIQUE SALAIRE & DÉDUCTION RETARDS/ABSENCES -->
        @if (categorie === 'SALAIRE') {
          <div class="salaire-box">
            <div class="field">
              <label for="empSelect">
                <strong>Bénéficiaire (Employé / Boulanger / Livreur) *</strong>
              </label>
              @if (chargementEmployes()) {
                <div class="chargement-info">Chargement de la liste du personnel…</div>
              } @else {
                <select
                  id="empSelect"
                  name="employeSelectionne"
                  [(ngModel)]="employeSelectionneId"
                  (ngModelChange)="surChangementEmploye($event)"
                >
                  <option [ngValue]="null">-- Choisir un employé --</option>
                  @for (emp of employes(); track emp.id) {
                    <option [ngValue]="emp.id">
                      {{ emp.nom }} ({{ emp.poste || emp.role }}) - Mode : {{ emp.frequencePaie || 'QUINZAINE' }} - Salaire base : {{ (emp.salaireBase || 0) | number }} FCFA
                    </option>
                  }
                </select>
              }
            </div>

            @if (erreurLimiteSalaire()) {
              <div class="alert alert-error salaire-limite-alert">
                <span class="alert-icon">⚠️</span>
                <span>{{ erreurLimiteSalaire() }}</span>
              </div>
            }

            @if (chargementAbsences()) {
              <div class="chargement-info">Vérification des paiements et retards du mois…</div>
            }

            @if (employeSelectionne()) {
              <div class="bulletin-mini-recap">
                <div class="recap-header">
                  <span class="recap-badge">Calcul automatique du Net</span>
                  <div class="recap-header-tags">
                    @if (badgeFrequence()) {
                      <span class="status-badge" [class.badge-danger]="erreurLimiteSalaire()">{{ badgeFrequence() }}</span>
                    }
                    <span class="mois-badge">Mois : {{ nomMoisActuel() }}</span>
                  </div>
                </div>

                <div class="recap-lignes">
                  <div class="recap-ligne">
                    <span>Mode rémunération :</span>
                    <strong>{{ employeSelectionne()?.frequencePaie || 'QUINZAINE' }} ({{ employeSelectionne()?.frequencePaie === 'MENSUEL' ? '1 versement / mois max' : '2 versements / mois max' }})</strong>
                  </div>

                  <div class="recap-ligne">
                    <span>Paye(s) déjà enregistrée(s) ce mois :</span>
                    <strong [class.text-danger]="nbPayesMois() > 0">{{ nbPayesMois() }} versement{{ nbPayesMois() > 1 ? 's' : '' }}</strong>
                  </div>

                  <div class="recap-ligne">
                    <span>Salaire de base contractuel :</span>
                    <strong>{{ (employeSelectionne()?.salaireBase || 0) | number }} FCFA</strong>
                  </div>

                  <div class="recap-ligne deduction">
                    <span>
                      Retenues pour retards & absences
                      ({{ absencesMois().length }} retenue{{ absencesMois().length > 1 ? 's' : '' }}) :
                    </span>
                    <strong class="text-danger">- {{ totalDeductions() | number }} FCFA</strong>
                  </div>

                  <div class="recap-ligne net">
                    <span>Net à décaisser / verser :</span>
                    <strong class="text-success">{{ salaireNetCalcule() | number }} FCFA</strong>
                  </div>
                </div>

                @if (absencesMois().length > 0) {
                  <div class="detail-absences">
                    <span class="detail-title">Détail des retenues du mois :</span>
                    <ul>
                      @for (abs of absencesMois(); track abs.id) {
                        <li>
                          <span class="date">{{ abs.dateAbsence }}</span> -
                          <span class="motif">{{ abs.motif || abs.typeGarde || 'Retard / Absence' }}</span> :
                          <span class="montant-deduit">-{{ abs.montantDeduit | number }} FCFA</span>
                        </li>
                      }
                    </ul>
                  </div>
                } @else {
                  <div class="aucun-retard-info">
                    Aucun retard ni absence déductible enregistré pour ce mois.
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="field">
          <label for="montantDep">
            Montant décaissé (FCFA) *
            @if (categorie === 'SALAIRE' && employeSelectionne()) {
              <span class="hint-calcule">(Calculé automatiquement après déduction des retards)</span>
            }
          </label>
          <input
            id="montantDep"
            name="montant"
            type="number"
            min="1"
            step="100"
            required
            [(ngModel)]="montant"
          />
        </div>

        <div class="field">
          <label for="libDep">Description / Motif de la dépense *</label>
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
          <button
            type="submit"
            class="btn-primary"
            [disabled]="enCours() || (categorie === 'SALAIRE' && !!erreurLimiteSalaire())"
          >
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer la dépense' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .dialog-subtitle {
        margin: 0;
        font-size: 0.82rem;
        color: var(--text-muted, #71717a);
      }
      .salaire-box {
        background: #fdfbf7;
        border: 1.5px solid #f2e3cc;
        border-radius: 14px;
        padding: 1rem;
        margin-bottom: 0.5rem;
      }
      .salaire-limite-alert {
        margin-top: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.86rem;
        font-weight: 600;
        padding: 0.65rem 0.85rem;
        border-radius: 8px;
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #f87171;
      }
      .alert-icon {
        font-size: 1.1rem;
      }
      .chargement-info {
        font-size: 0.85rem;
        color: #b45309;
        font-style: italic;
        padding: 0.4rem 0;
      }
      .bulletin-mini-recap {
        margin-top: 0.75rem;
        background: #ffffff;
        border: 1px solid #e7ded4;
        border-radius: 12px;
        padding: 0.85rem;
      }
      .recap-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.65rem;
      }
      .recap-header-tags {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .recap-badge {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        background: #fef3c7;
        color: #92400e;
        padding: 2px 8px;
        border-radius: 6px;
      }
      .status-badge {
        font-size: 0.75rem;
        font-weight: 700;
        background: #ecfdf5;
        color: #065f46;
        padding: 2px 8px;
        border-radius: 6px;
        border: 1px solid #a7f3d0;
      }
      .status-badge.badge-danger {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fca5a5;
      }
      .mois-badge {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 600;
      }
      .recap-lignes {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.88rem;
      }
      .recap-ligne {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .recap-ligne.deduction {
        color: #dc2626;
      }
      .recap-ligne.net {
        font-size: 1.05rem;
        padding-top: 0.45rem;
        border-top: 1px dashed #d1d5db;
        margin-top: 0.35rem;
      }
      .text-danger {
        color: #dc2626;
      }
      .text-success {
        color: #16a34a;
        font-size: 1.15rem;
      }
      .detail-absences {
        margin-top: 0.75rem;
        padding-top: 0.5rem;
        border-top: 1px solid #f3f4f6;
        font-size: 0.8rem;
      }
      .detail-title {
        font-weight: 600;
        color: #4b5563;
        display: block;
        margin-bottom: 0.3rem;
      }
      .detail-absences ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .detail-absences li {
        padding: 0.2rem 0;
        color: #4b5563;
      }
      .detail-absences .date {
        font-weight: 600;
      }
      .detail-absences .montant-deduit {
        color: #dc2626;
        font-weight: 700;
      }
      .aucun-retard-info {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: #16a34a;
        font-weight: 500;
      }
      .hint-calcule {
        font-size: 0.75rem;
        color: #16a34a;
        font-weight: normal;
        margin-left: 0.5rem;
      }
    `,
  ],
})
export class DepenseDialogComponent implements OnInit {
  private readonly service = inject(DepenseService);
  private readonly utilisateurService = inject(UtilisateurService);

  @Input() dateParDefaut = '';
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Depense>();

  protected dateDepense = '';
  protected categorie: CategorieDepense = 'FARINE';
  protected montant: number | null = null;
  protected libelle = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  // État lié aux salaires et déductions d'absences
  protected readonly employes = signal<Utilisateur[]>([]);
  protected readonly chargementEmployes = signal(false);
  protected readonly employeSelectionneId = signal<number | null>(null);
  protected readonly employeSelectionne = signal<Utilisateur | null>(null);
  protected readonly chargementAbsences = signal(false);
  protected readonly absencesMois = signal<AbsenceEmploye[]>([]);
  protected readonly totalDeductions = signal(0);
  protected readonly salaireNetCalcule = signal(0);
  protected readonly erreurLimiteSalaire = signal<string | null>(null);
  protected readonly nbPayesMois = signal(0);
  protected readonly badgeFrequence = signal('');

  ngOnInit(): void {
    this.dateDepense = this.dateParDefaut || new Date().toISOString().slice(0, 10);
    if (this.categorie === 'SALAIRE') {
      this.chargerEmployes();
    }
  }

  protected surChangementCategorie(nouvelleCat: CategorieDepense): void {
    this.categorie = nouvelleCat;
    if (this.categorie === 'SALAIRE') {
      this.chargerEmployes();
    } else {
      this.employeSelectionneId.set(null);
      this.employeSelectionne.set(null);
      this.absencesMois.set([]);
      this.totalDeductions.set(0);
      this.salaireNetCalcule.set(0);
      this.erreurLimiteSalaire.set(null);
      this.nbPayesMois.set(0);
      this.badgeFrequence.set('');
    }
  }

  protected surChangementDate(): void {
    if (this.categorie === 'SALAIRE' && this.employeSelectionne()) {
      this.recalculerSalaire(this.employeSelectionne()!);
    }
  }

  protected nomMoisActuel(): string {
    if (!this.dateDepense) return '';
    try {
      const d = new Date(this.dateDepense + 'T00:00:00');
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } catch {
      return this.dateDepense;
    }
  }

  private chargerEmployes(): void {
    if (this.employes().length > 0) return;
    this.chargementEmployes.set(true);
    this.utilisateurService.lister().subscribe({
      next: (liste) => {
        this.chargementEmployes.set(false);
        // Filtrer les comptes actifs
        this.employes.set(liste.filter((u) => u.actif !== false));
      },
      error: () => {
        this.chargementEmployes.set(false);
      },
    });
  }

  protected surChangementEmploye(id: number | null): void {
    this.employeSelectionneId.set(id);
    if (!id) {
      this.employeSelectionne.set(null);
      this.absencesMois.set([]);
      this.totalDeductions.set(0);
      this.salaireNetCalcule.set(0);
      this.erreurLimiteSalaire.set(null);
      this.nbPayesMois.set(0);
      this.badgeFrequence.set('');
      return;
    }
    const emp = this.employes().find((u) => u.id === id) || null;
    this.employeSelectionne.set(emp);
    if (emp) {
      this.recalculerSalaire(emp);
    }
  }

  private recalculerSalaire(emp: Utilisateur): void {
    const base = emp.salaireBase || 0;
    const moisCible = (this.dateDepense || new Date().toISOString()).slice(0, 7); // "YYYY-MM"
    const moisNom = this.nomMoisActuel();

    this.chargementAbsences.set(true);
    this.erreurLimiteSalaire.set(null);

    forkJoin({
      absences: this.utilisateurService.listerAbsences(emp.id).pipe(catchError(() => of([]))),
      depenses: this.service.lister().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ absences, depenses }) => {
        this.chargementAbsences.set(false);

        // Filtrer absences pour le mois cible
        const absDuMois = (absences || []).filter(
          (a) => a.dateAbsence && a.dateAbsence.startsWith(moisCible)
        );
        this.absencesMois.set(absDuMois);

        const ded = absDuMois.reduce((acc, a) => acc + (a.montantDeduit || 0), 0);
        this.totalDeductions.set(ded);

        const net = Math.max(0, base - ded);
        this.salaireNetCalcule.set(net);
        this.montant = net;

        // Contrôle du nombre de payes déjà effectuées ce mois-ci
        const nomEmp = emp.nom.trim().toLowerCase();
        const payesMois = (depenses || []).filter(
          (d) =>
            d.categorie === 'SALAIRE' &&
            (d.dateDepense || '').startsWith(moisCible) &&
            (d.libelle || '').toLowerCase().includes(nomEmp)
        );
        const count = payesMois.length;
        this.nbPayesMois.set(count);

        const frequence = (emp.frequencePaie || 'QUINZAINE').toUpperCase();
        const estMensuel = frequence.includes('MENSUEL');

        let prefixe = '';
        if (estMensuel) {
          if (count >= 1) {
            this.erreurLimiteSalaire.set(
              `Cet employé a déjà reçu sa paye pour ce mois (${emp.nom} est en rémunération mensuelle : 1 paye maximum par mois).`
            );
            this.badgeFrequence.set('Paye du mois déjà reçue (1/1)');
          } else {
            this.badgeFrequence.set('Paye Mensuelle (1/1)');
          }
          prefixe = 'Salaire';
        } else {
          // Quinzaine
          if (count >= 2) {
            this.erreurLimiteSalaire.set(
              `Cet employé a déjà reçu ses 2 payes pour ce mois (${emp.nom} est en rémunération par quinzaine : 2 payes maximum par mois).`
            );
            this.badgeFrequence.set('2/2 Quinzaines déjà versées');
          } else if (count === 1) {
            this.badgeFrequence.set('2ème Quinzaine (2/2)');
            prefixe = 'Salaire 2ème Quinzaine';
          } else {
            this.badgeFrequence.set('1ère Quinzaine (1/2)');
            prefixe = 'Salaire 1ère Quinzaine';
          }
        }

        if (ded > 0) {
          this.libelle = `${prefixe} ${moisNom} - ${emp.nom} (Base: ${base.toLocaleString()} F, Retards: -${ded.toLocaleString()} F)`;
        } else {
          this.libelle = `${prefixe} ${moisNom} - ${emp.nom} (Base: ${base.toLocaleString()} F)`;
        }
      },
      error: () => {
        this.chargementAbsences.set(false);
        this.absencesMois.set([]);
        this.totalDeductions.set(0);
        this.salaireNetCalcule.set(base);
        this.montant = base;
        this.libelle = `Salaire ${moisNom} - ${emp.nom}`;
      },
    });
  }

  protected enregistrer(): void {
    if (this.categorie === 'SALAIRE' && this.erreurLimiteSalaire()) {
      this.erreur.set(this.erreurLimiteSalaire());
      return;
    }
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
