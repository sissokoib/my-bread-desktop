import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TourneeClotureDialogComponent } from '../../dialogs/tournee-cloture-dialog.component';
import { TourneeDialogComponent } from '../../dialogs/tournee-dialog.component';
import { TourneeVersementDialogComponent } from '../../dialogs/tournee-versement-dialog.component';
import { Tournee } from '../../models/operations.model';
import { Produit } from '../../models/produit.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { messageErreur } from '../../services/message-erreur';
import { ProduitService } from '../../services/produit.service';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

@Component({
  selector: 'app-tournees',
  imports: [
    FormsModule,
    DecimalPipe,
    TourneeDialogComponent,
    TourneeClotureDialogComponent,
    TourneeVersementDialogComponent,
  ],
  templateUrl: './tournees.component.html',
  styleUrl: './tournees.component.css',
})
export class TourneesComponent implements OnInit {
  private readonly tourneeService = inject(TourneeService);
  private readonly produitService = inject(ProduitService);
  private readonly utilisateurService = inject(UtilisateurService);

  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly dateFiltre = signal(new Date().toISOString().slice(0, 10));
  protected readonly filtreStatut = signal<'TOUT' | 'EN_COURS' | 'CLOTUREES'>('TOUT');
  protected readonly erreur = signal<string | null>(null);
  protected readonly succesMessage = signal<string | null>(null);

  protected readonly dialogCreation = signal(false);
  protected readonly tourneePourCloture = signal<Tournee | null>(null);
  protected readonly tourneePourVersement = signal<Tournee | null>(null);

  protected readonly livreursActifs = computed(() =>
    this.utilisateurs().filter(
      (u) =>
        u.role === 'LIVREUR' &&
        u.actif &&
        (!u.poste || u.poste.toLowerCase().includes('livreur')) &&
        !u.nom.toLowerCase().includes('djelimakan'),
    ),
  );

  protected readonly produitsActifs = computed(() =>
    this.produits().filter((p) => p.actif),
  );

  protected readonly tourneesFiltrees = computed(() => {
    const f = this.filtreStatut();
    if (f === 'EN_COURS') {
      return this.tournees().filter((t) => t.statut !== 'CLOTUREE');
    }
    if (f === 'CLOTUREES') {
      return this.tournees().filter((t) => t.statut === 'CLOTUREE');
    }
    return this.tournees();
  });

  protected readonly totalLivreursPartis = computed(() => this.tournees().length);

  protected readonly countEnCours = computed(
    () => this.tournees().filter((t) => t.statut !== 'CLOTUREE').length,
  );

  protected readonly countCloturees = computed(
    () => this.tournees().filter((t) => t.statut === 'CLOTUREE').length,
  );

  protected readonly totalPainsCharges = computed(() =>
    this.tournees().reduce(
      (acc, t) =>
        acc +
        (t.bilansProduits ?? []).reduce((s, b) => s + (b.quantiteChargee || 0), 0),
      0,
    ),
  );

  protected readonly totalPainsRetournes = computed(() =>
    this.tournees().reduce(
      (acc, t) =>
        acc +
        (t.bilansProduits ?? []).reduce((s, b) => s + (b.quantiteRetournee || 0), 0),
      0,
    ),
  );

  protected readonly totalPainsVendus = computed(() =>
    Math.max(0, this.totalPainsCharges() - this.totalPainsRetournes()),
  );

  protected readonly totalVentesLivreurs = computed(() =>
    this.tournees().reduce((acc, t) => acc + (t.totalVentes || 0), 0),
  );

  protected readonly totalEncaisseLivreurs = computed(() =>
    this.tournees().reduce((acc, t) => acc + (t.totalEncaisse || 0), 0),
  );

  protected readonly totalResteADevoir = computed(() =>
    Math.max(0, this.totalVentesLivreurs() - this.totalEncaisseLivreurs()),
  );

  ngOnInit(): void {
    forkJoin({
      produits: this.produitService.lister(),
      utilisateurs: this.utilisateurService
        .lister()
        .pipe(catchError(() => of([] as Utilisateur[]))),
    }).subscribe({
      next: ({ produits, utilisateurs }) => {
        this.produits.set(produits);
        this.utilisateurs.set(utilisateurs);
      },
    });
    this.chargerDonnees();
  }

  protected changerDate(date: string): void {
    this.dateFiltre.set(date);
    this.chargerDonnees();
  }

  protected apresAction(): void {
    this.dialogCreation.set(false);
    this.tourneePourCloture.set(null);
    this.tourneePourVersement.set(null);
    this.succesMessage.set('Opération enregistrée avec succès et caisse mise à jour.');
    this.chargerDonnees();
    setTimeout(() => this.succesMessage.set(null), 4000);
  }

  protected libelleCreneau(t: Tournee): string {
    if (t.remarques?.includes('[Matin]')) return '☀️ Sortie Matin';
    if (t.remarques?.includes('[Soir]')) return '🌙 Sortie Soir';
    if (t.remarques?.includes('[Réappro]')) return '⚡ Réapprovisionnement';
    return 'Sortie journalière';
  }

  protected couleurCreneau(t: Tournee): { bg: string; color: string; border: string } {
    if (t.remarques?.includes('[Matin]')) {
      return { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' };
    }
    if (t.remarques?.includes('[Soir]')) {
      return { bg: '#EDE9FE', color: '#5B21B6', border: '#C4B5FD' };
    }
    if (t.remarques?.includes('[Réappro]')) {
      return { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
    }
    return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' };
  }

  protected remarquesSansTag(t: Tournee): string {
    if (!t.remarques) return '';
    return t.remarques.replace(/\[(Matin|Soir|Réappro)\]\s*/gi, '').trim();
  }

  protected chargerDonnees(): void {
    const d = this.dateFiltre() || undefined;
    this.tourneeService.lister(d).subscribe({
      next: (tournees) => {
        this.tournees.set(tournees);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
