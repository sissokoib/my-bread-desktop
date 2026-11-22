import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AbsenceDialogComponent } from '../../dialogs/absence-dialog.component';
import { EmployeDialogComponent } from '../../dialogs/employe-dialog.component';
import { Depense } from '../../models/operations.model';
import { Role, Utilisateur } from '../../models/utilisateur.model';
import { resoudreUrlPhoto } from '../../services/api.config';
import { DepenseService } from '../../services/depense.service';
import { messageErreur } from '../../services/message-erreur';
import { UtilisateurService } from '../../services/utilisateur.service';

/** Filtre par type d'employé dans la liste de l'équipe. */
type FiltreType = 'TOUS' | 'DIRECT' | 'LIVREUR';

/** Ligne de suivi de la ration journalière d'un employé direct. */
interface LigneRation {
  employe: Utilisateur;
  montant: number;
  depense: Depense | null;
}

/** Marqueur technique placé dans le libellé de la dépense pour retrouver la ration ou l'avance d'un employé. */
const TAG_RATION = (id: number) => `[RATION#${id}]`;
const REGEX_TAG_RATION = /\[RATION#(\d+)\]/;
const TAG_AVANCE = (id: number) => `[AVANCE#${id}]`;
const REGEX_TAG_AVANCE = /\[AVANCE#(\d+)\]/;

@Component({
  selector: 'app-utilisateurs',
  imports: [FormsModule, DecimalPipe, EmployeDialogComponent, AbsenceDialogComponent],
  templateUrl: './utilisateurs.component.html',
  styleUrl: './utilisateurs.component.css',
})
export class UtilisateursComponent implements OnInit {
  private readonly service = inject(UtilisateurService);
  private readonly depenseService = inject(DepenseService);

  protected readonly resoudreUrlPhoto = resoudreUrlPhoto;

  protected initiales(nom?: string | null): string {
    if (!nom) return 'E';
    const parts = nom.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nom.slice(0, 2).toUpperCase();
  }

  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly recherche = signal('');
  protected readonly typeFiltre = signal<FiltreType>('TOUS');
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogNouvelEmploye = signal(false);
  protected readonly employePourAbsence = signal<Utilisateur | null>(null);

  // ---------- Avances sur salaire ----------
  protected readonly toutesDepenses = signal<Depense[]>([]);
  protected readonly employePourAvance = signal<Utilisateur | null>(null);
  protected readonly montantNouvelleAvance = signal<number | null>(5000);
  protected readonly motifNouvelleAvance = signal('');
  protected readonly dateNouvelleAvance = signal(new Date().toISOString().slice(0, 10));
  protected readonly avanceEnCours = signal(false);

  // ---------- Rations journalières ----------
  protected readonly dateRation = signal(new Date().toISOString().slice(0, 10));
  protected readonly depensesRation = signal<Depense[]>([]);
  protected readonly rationEnCours = signal<number | 'TOUS' | null>(null);
  protected readonly messageRation = signal<string | null>(null);

  /** Un livreur n'est pas un employé direct de la boulangerie. */
  protected estLivreur(u: Utilisateur): boolean {
    return u.role === 'LIVREUR';
  }

  /** Un compte de direction (PDG / Gérant sans salaire) n'est pas soumis aux retenues d'absences ni aux avances. */
  protected estCompteDirection(u: Utilisateur): boolean {
    return u.role === 'PDG' || u.role === 'SUPER_ADMIN' || (u.role === 'ADMIN' && !(u.salaireBase && u.salaireBase > 0));
  }

  /** Liste des membres de l'équipe (exclut les comptes PDG / Super-Admin). */
  protected readonly membresEquipe = computed(() =>
    this.utilisateurs().filter((u) => u.role !== 'SUPER_ADMIN' && u.role !== 'PDG' && u.role !== 'BOUTIQUIER'),
  );

  /** Personnel interne salarié (hors livreurs et hors comptes direction). */
  protected readonly employesDirects = computed(() =>
    this.membresEquipe().filter((u) => u.role !== 'LIVREUR' && !this.estCompteDirection(u)),
  );

  protected readonly nbLivreurs = computed(() => this.membresEquipe().filter((u) => u.role === 'LIVREUR').length);
  protected readonly nbEmployesDirects = computed(() => this.employesDirects().length);

  protected readonly totalSalairesBase = computed(() =>
    this.employesDirects().reduce((acc, u) => acc + (u.salaireBase || 0), 0),
  );

  protected readonly totalDeductionsGlobales = computed(() =>
    this.employesDirects().reduce((acc, u) => acc + (u.totalDeductions || 0) + this.totalAvancesEmploye(u.id), 0),
  );

  protected readonly totalAbsencesGlobales = computed(() =>
    this.employesDirects().reduce((acc, u) => acc + (u.nombreAbsences || 0), 0),
  );

  protected readonly totalAvancesGlobales = computed(() =>
    this.employesDirects().reduce((acc, u) => acc + this.totalAvancesEmploye(u.id), 0),
  );

  protected readonly totalSalairesNets = computed(() =>
    this.employesDirects().reduce(
      (acc, u) => acc + this.salaireNetApresAvances(u),
      0,
    ),
  );

  protected avancesEmploye(employeId: number): Depense[] {
    const tag = TAG_AVANCE(employeId);
    return this.toutesDepenses().filter((d) => d.libelle?.includes(tag));
  }

  protected totalAvancesEmploye(employeId: number): number {
    return this.avancesEmploye(employeId).reduce((s, d) => s + (d.montant || 0), 0);
  }

  protected salaireNetApresAvances(u: Utilisateur): number {
    const netApresAbsences = u.salaireNet !== undefined ? u.salaireNet : (u.salaireBase || 0) - (u.totalDeductions || 0);
    return Math.max(0, netApresAbsences - this.totalAvancesEmploye(u.id));
  }

  protected libelleAvancePropre(d: Depense): string {
    return (d.libelle || '').replace(/\s*\[AVANCE#\d+\]/g, '').trim();
  }

  protected readonly utilisateursFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const type = this.typeFiltre();
    return this.membresEquipe().filter((u) => {
      if (type === 'LIVREUR' && u.role !== 'LIVREUR') return false;
      if (type === 'DIRECT' && u.role === 'LIVREUR') return false;
      if (!q) return true;
      return (
        u.nom.toLowerCase().includes(q) ||
        u.telephone.includes(q) ||
        (u.quartier && u.quartier.toLowerCase().includes(q)) ||
        (u.poste && u.poste.toLowerCase().includes(q))
      );
    });
  });

  /** Liste des rations du jour sélectionné (employés directs ayant une ration > 0). */
  protected readonly lignesRation = computed<LigneRation[]>(() => {
    const depenses = this.depensesRation();
    return this.employesDirects()
      .filter((u) => u.actif && (u.rationJournaliere || 0) > 0)
      .map((u) => ({
        employe: u,
        montant: u.rationJournaliere || 0,
        depense: depenses.find((d) => d.libelle?.includes(TAG_RATION(u.id))) ?? null,
      }));
  });

  protected readonly nbRationsPayees = computed(() => this.lignesRation().filter((l) => l.depense).length);
  protected readonly totalRationsPayees = computed(() =>
    this.lignesRation()
      .filter((l) => l.depense)
      .reduce((s, l) => s + (l.depense?.montant || 0), 0),
  );
  protected readonly totalRationsRestantes = computed(() =>
    this.lignesRation()
      .filter((l) => !l.depense)
      .reduce((s, l) => s + l.montant, 0),
  );

  ngOnInit(): void {
    this.charger();
    this.chargerRations();
    this.chargerAvances();
  }

  protected libelleRole(role: Role): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'PDG';
      case 'PDG':
        return 'PDG';
      case 'ADMIN':
        return 'Gérant';
      case 'LIVREUR':
        return 'Livreur';
      case 'GESTIONNAIRE':
        return 'Gestionnaire';
      default:
        return 'Employé';
    }
  }

  protected estPosteIdentiqueAuRole(poste?: string | null, role?: Role): boolean {
    if (!poste || !role) return true;
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return norm(poste) === norm(this.libelleRole(role));
  }

  protected ouvrirAbsence(u: Utilisateur): void {
    this.employePourAbsence.set(u);
  }

  protected ouvrirAvance(u: Utilisateur): void {
    this.employePourAvance.set(u);
    this.montantNouvelleAvance.set(5000);
    this.motifNouvelleAvance.set('');
    this.dateNouvelleAvance.set(new Date().toISOString().slice(0, 10));
  }

  protected enregistrerAvance(): void {
    const emp = this.employePourAvance();
    const montant = this.montantNouvelleAvance();
    if (!emp || !montant || montant <= 0 || this.avanceEnCours()) return;

    this.avanceEnCours.set(true);
    const motif = this.motifNouvelleAvance().trim();
    this.depenseService
      .creer({
        dateDepense: this.dateNouvelleAvance() || new Date().toISOString().slice(0, 10),
        categorie: 'SALAIRE',
        montant: Math.round(montant),
        libelle: `Avance sur salaire - ${emp.nom}${motif ? ' (' + motif + ')' : ''} ${TAG_AVANCE(emp.id)}`,
      })
      .subscribe({
        next: () => {
          this.avanceEnCours.set(false);
          this.motifNouvelleAvance.set('');
          this.afficherMessageRation(`Avance de ${montant.toLocaleString()} FCFA accordée à ${emp.nom} et déduite du salaire net.`);
          this.chargerAvances();
          this.chargerRations();
        },
        error: (err) => {
          this.avanceEnCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }

  protected supprimerAvance(depense: Depense): void {
    if (this.avanceEnCours()) return;
    if (!confirm('Annuler cette avance sur salaire ?')) return;
    this.avanceEnCours.set(true);
    this.depenseService.supprimer(depense.id).subscribe({
      next: () => {
        this.avanceEnCours.set(false);
        this.chargerAvances();
      },
      error: (err) => {
        this.avanceEnCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected chargerAvances(): void {
    this.depenseService.lister().subscribe({
      next: (liste) => this.toutesDepenses.set((liste || []).filter((d) => REGEX_TAG_AVANCE.test(d.libelle || ''))),
      error: () => {},
    });
  }

  protected apresCreationEmploye(): void {
    this.dialogNouvelEmploye.set(false);
    this.charger();
  }

  protected charger(): void {
    this.service.lister().subscribe({
      next: (liste) => {
        this.utilisateurs.set(liste);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  // ---------- Gestion des rations ----------

  protected changerDateRation(date: string): void {
    if (!date) return;
    this.dateRation.set(date);
    this.chargerRations();
  }

  protected decalerDateRation(jours: number): void {
    const d = new Date(this.dateRation());
    d.setDate(d.getDate() + jours);
    this.changerDateRation(d.toISOString().slice(0, 10));
  }

  protected chargerRations(): void {
    this.depenseService.lister(this.dateRation()).subscribe({
      next: (liste) => this.depensesRation.set((liste || []).filter((d) => REGEX_TAG_RATION.test(d.libelle || ''))),
      error: () => this.depensesRation.set([]),
    });
  }

  protected payerRation(ligne: LigneRation): void {
    if (ligne.depense || this.rationEnCours()) return;
    this.rationEnCours.set(ligne.employe.id);
    this.depenseService
      .creer({
        dateDepense: this.dateRation(),
        categorie: 'SALAIRE',
        montant: ligne.montant,
        libelle: `Ration journalière - ${ligne.employe.nom} ${TAG_RATION(ligne.employe.id)}`,
      })
      .subscribe({
        next: () => {
          this.rationEnCours.set(null);
          this.afficherMessageRation(`Ration de ${ligne.employe.nom} marquée comme payée.`);
          this.chargerRations();
        },
        error: (err) => {
          this.rationEnCours.set(null);
          this.erreur.set(messageErreur(err));
        },
      });
  }

  protected annulerRation(ligne: LigneRation): void {
    if (!ligne.depense || this.rationEnCours()) return;
    if (!confirm(`Annuler le paiement de la ration de ${ligne.employe.nom} pour le ${this.dateRation()} ?`)) return;
    this.rationEnCours.set(ligne.employe.id);
    this.depenseService.supprimer(ligne.depense.id).subscribe({
      next: () => {
        this.rationEnCours.set(null);
        this.afficherMessageRation(`Paiement de la ration de ${ligne.employe.nom} annulé.`);
        this.chargerRations();
      },
      error: (err) => {
        this.rationEnCours.set(null);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected payerToutesRations(): void {
    const aPayer = this.lignesRation().filter((l) => !l.depense);
    if (aPayer.length === 0 || this.rationEnCours()) return;
    this.rationEnCours.set('TOUS');
    forkJoin(
      aPayer.map((l) =>
        this.depenseService.creer({
          dateDepense: this.dateRation(),
          categorie: 'SALAIRE',
          montant: l.montant,
          libelle: `Ration journalière - ${l.employe.nom} ${TAG_RATION(l.employe.id)}`,
        }),
      ),
    ).subscribe({
      next: () => {
        this.rationEnCours.set(null);
        this.afficherMessageRation(`${aPayer.length} ration(s) marquée(s) comme payée(s).`);
        this.chargerRations();
      },
      error: (err) => {
        this.rationEnCours.set(null);
        this.erreur.set(messageErreur(err));
        this.chargerRations();
      },
    });
  }

  private afficherMessageRation(msg: string): void {
    this.messageRation.set(msg);
    setTimeout(() => this.messageRation.set(null), 4000);
  }
}
