import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbsenceDialogComponent } from '../../dialogs/absence-dialog.component';
import { EmployeDialogComponent } from '../../dialogs/employe-dialog.component';
import { Role, Utilisateur } from '../../models/utilisateur.model';
import { resoudreUrlPhoto } from '../../services/api.config';
import { messageErreur } from '../../services/message-erreur';
import { UtilisateurService } from '../../services/utilisateur.service';

@Component({
  selector: 'app-utilisateurs',
  imports: [FormsModule, DecimalPipe, EmployeDialogComponent, AbsenceDialogComponent],
  templateUrl: './utilisateurs.component.html',
  styleUrl: './utilisateurs.component.css',
})
export class UtilisateursComponent implements OnInit {
  private readonly service = inject(UtilisateurService);

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
  protected readonly roleFiltre = signal<Role | null>(null);
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogNouvelEmploye = signal(false);
  protected readonly employePourAbsence = signal<Utilisateur | null>(null);

  protected readonly nbLivreurs = computed(
    () => this.utilisateurs().filter((u) => u.role === 'LIVREUR').length,
  );
  protected readonly nbBoulangers = computed(
    () => this.utilisateurs().filter((u) => u.role === 'ADMIN' || u.role === 'GESTIONNAIRE').length,
  );

  protected readonly totalSalairesBase = computed(() =>
    this.utilisateurs().reduce((acc, u) => acc + (u.salaireBase || 0), 0),
  );

  protected readonly totalDeductionsGlobales = computed(() =>
    this.utilisateurs().reduce((acc, u) => acc + (u.totalDeductions || 0), 0),
  );

  protected readonly totalAbsencesGlobales = computed(() =>
    this.utilisateurs().reduce((acc, u) => acc + (u.nombreAbsences || 0), 0),
  );

  protected readonly totalSalairesNets = computed(() =>
    this.utilisateurs().reduce(
      (acc, u) => acc + (u.salaireNet !== undefined ? u.salaireNet : u.salaireBase || 0),
      0,
    ),
  );

  protected readonly utilisateursFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const role = this.roleFiltre();
    return this.utilisateurs().filter((u) => {
      if (role !== null && u.role !== role) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        u.nom.toLowerCase().includes(q) ||
        u.telephone.includes(q) ||
        (u.quartier && u.quartier.toLowerCase().includes(q)) ||
        (u.poste && u.poste.toLowerCase().includes(q))
      );
    });
  });

  ngOnInit(): void {
    this.charger();
  }

  protected libelleRole(role: Role): string {
    switch (role) {
      case 'SUPER_ADMIN':
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

  protected ouvrirAbsence(u: Utilisateur): void {
    this.employePourAbsence.set(u);
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
}
