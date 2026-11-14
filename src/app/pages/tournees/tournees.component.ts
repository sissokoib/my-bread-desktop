import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TourneeClotureDialogComponent } from '../../dialogs/tournee-cloture-dialog.component';
import { TourneeDialogComponent } from '../../dialogs/tournee-dialog.component';
import { Client } from '../../models/client.model';
import {
  Commande,
  Livraison,
  StatutCommande,
  Tournee,
} from '../../models/operations.model';
import { Produit } from '../../models/produit.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { ClientService } from '../../services/client.service';
import { CommandeService } from '../../services/commande.service';
import { LivraisonService } from '../../services/livraison.service';
import { messageErreur } from '../../services/message-erreur';
import { ProduitService } from '../../services/produit.service';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

@Component({
  selector: 'app-tournees',
  imports: [FormsModule,
    DecimalPipe,
    TourneeDialogComponent,
    TourneeClotureDialogComponent,],
  templateUrl: './tournees.component.html',
  styleUrl: './tournees.component.css',
})
export class TourneesComponent implements OnInit {
  private readonly tourneeService = inject(TourneeService);
  private readonly livraisonService = inject(LivraisonService);
  private readonly commandeService = inject(CommandeService);
  private readonly produitService = inject(ProduitService);
  private readonly clientService = inject(ClientService);
  private readonly utilisateurService = inject(UtilisateurService);

  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly livraisons = signal<Livraison[]>([]);
  protected readonly commandes = signal<Commande[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly dateFiltre = signal(new Date().toISOString().slice(0, 10));
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogCreation = signal(false);
  protected readonly tourneePourCloture = signal<Tournee | null>(null);

  protected readonly produitsActifs = computed(() =>
    this.produits().filter((p) => p.actif),
  );
  protected readonly clientsActifs = computed(() =>
    this.clients().filter((c) => c.actif),
  );
  protected readonly livreursActifs = computed(() =>
    this.utilisateurs().filter(
      (u) =>
        u.role === 'LIVREUR' &&
        u.actif &&
        (!u.poste || u.poste.toLowerCase().includes('livreur')) &&
        !u.nom.toLowerCase().includes('djelimakan')
    ),
  );

  /** Commandes dont le statut est à livrer (VALIDEE, PREPAREE ou EN_ATTENTE) */
  protected readonly commandesALivrer = computed(() => {
    return this.commandes().filter(
      (c) => c.statut === 'VALIDEE' || c.statut === 'PREPAREE' || c.statut === 'EN_ATTENTE',
    );
  });

  /** Nombre total de pains commandés en attente de livraison */
  protected readonly totalPainsALivrer = computed(() => {
    return this.commandesALivrer().reduce(
      (acc, c) => acc + (c.lignes?.reduce((sum, l) => sum + (l.quantite || 0), 0) || 0),
      0,
    );
  });

  /** Montant total des commandes à livrer */
  protected readonly totalMontantALivrer = computed(() => {
    return this.commandesALivrer().reduce((acc, c) => acc + (c.montantTotal || 0), 0);
  });

  /** Récapitulatif groupé par type de pain pour le chargement des livreurs */
  protected readonly recapPainsParProduit = computed(() => {
    const map = new Map<string, number>();
    for (const c of this.commandesALivrer()) {
      if (c.lignes) {
        for (const l of c.lignes) {
          const nom = l.produitNom || 'Pain';
          map.set(nom, (map.get(nom) || 0) + (l.quantite || 0));
        }
      }
    }
    return Array.from(map.entries()).map(([nom, quantite]) => ({ nom, quantite }));
  });

  ngOnInit(): void {
    forkJoin({
      produits: this.produitService.lister(),
      clients: this.clientService.lister(),
      utilisateurs: this.utilisateurService
        .lister()
        .pipe(catchError(() => of([] as Utilisateur[]))),
    }).subscribe({
      next: ({ produits, clients, utilisateurs }) => {
        this.produits.set(produits);
        this.clients.set(clients);
        this.utilisateurs.set(utilisateurs);
      },
    });
    this.chargerDonnees();
  }

  protected changerDate(date: string): void {
    this.dateFiltre.set(date);
    this.chargerDonnees();
  }

  protected sommePainsCommande(c: Commande): number {
    return c.lignes?.reduce((sum, l) => sum + (l.quantite || 0), 0) || 0;
  }

  protected libelleStatutCommande(statut: StatutCommande): string {
    switch (statut) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'VALIDEE':
      case 'PREPAREE':
        return 'Validée';
      case 'LIVREE':
        return 'Livrée';
      case 'ANNULEE':
        return 'Annulée';
      default:
        return statut;
    }
  }

  protected marquerCommandeLivree(c: Commande): void {
    this.commandeService.changerStatut(c.id, 'LIVREE').subscribe({
      next: () => this.chargerDonnees(),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected apresAction(): void {
    this.dialogCreation.set(false);
    this.tourneePourCloture.set(null);
    this.chargerDonnees();
  }

  private chargerDonnees(): void {
    const d = this.dateFiltre() || undefined;
    forkJoin({
      tournees: this.tourneeService.lister(d),
      livraisons: this.livraisonService.lister({ date: d }),
      commandes: this.commandeService.lister(d).pipe(catchError(() => of([] as Commande[]))),
    }).subscribe({
      next: ({ tournees, livraisons, commandes }) => {
        this.tournees.set(tournees);
        this.livraisons.set(livraisons);
        this.commandes.set(commandes);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
