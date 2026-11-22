import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandeDialogComponent } from '../../dialogs/commande-dialog.component';
import {
  Commande,
  CommandeCreationRequest,
  StatutCommande,
} from '../../models/operations.model';
import { CommandeService } from '../../services/commande.service';
import { messageErreur } from '../../services/message-erreur';
import { PaiementService } from '../../services/paiement.service';

@Component({
  selector: 'app-commandes',
  imports: [FormsModule, DecimalPipe, CommandeDialogComponent],
  templateUrl: './commandes.component.html',
  styleUrl: './commandes.component.css',
})
export class CommandesComponent implements OnInit {
  private readonly service = inject(CommandeService);
  private readonly paiementService = inject(PaiementService);

  protected readonly commandes = signal<Commande[]>([]);
  protected readonly dateFiltre = signal('');
  protected readonly statutFiltre = signal<StatutCommande | ''>('');
  protected readonly ongletActif = signal<'TOUT' | 'VENTES_CAISSE' | 'COMMANDES_CLIENTS'>('TOUT');
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogueOuvert = signal(false);
  protected readonly modeDialogueInitial = signal<'DIRECTE' | 'PRECOMMANDE'>('DIRECTE');
  protected readonly enregistrement = signal(false);
  protected readonly erreurDialogue = signal<string | null>(null);
  protected readonly commandePourTicket = signal<Commande | null>(null);

  protected filtrerDateRapide(cible: 'AUJOURDHUI' | 'HIER' | 'TOUT'): void {
    if (cible === 'TOUT') {
      this.dateFiltre.set('');
    } else if (cible === 'AUJOURDHUI') {
      this.dateFiltre.set(new Date().toISOString().slice(0, 10));
    } else {
      const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.dateFiltre.set(hier);
    }
    this.charger();
  }

  protected ouvrirTicket(c: Commande): void {
    this.commandePourTicket.set(c);
  }

  protected imprimerTicket(): void {
    window.print();
  }

  /** Liste de toutes les ventes directes effectuées à la caisse de la boulangerie. */
  protected readonly ventesCaisse = computed(() =>
    this.commandes().filter((c) => this.estCommandeDirecte(c)),
  );

  /** Liste de toutes les commandes passées par des clients. */
  protected readonly commandesClients = computed(() =>
    this.commandes().filter((c) => !this.estCommandeDirecte(c)),
  );

  protected readonly totalVentesCaisseMontant = computed(() =>
    this.ventesCaisse()
      .filter((c) => c.statut !== 'ANNULEE')
      .reduce((acc, c) => acc + c.montantTotal, 0),
  );

  protected readonly totalPainsVendusCaisse = computed(() =>
    this.ventesCaisse()
      .filter((c) => c.statut !== 'ANNULEE')
      .reduce((acc, c) => acc + c.lignes.reduce((s, l) => s + l.quantite, 0), 0),
  );

  protected readonly totalEnAttente = computed(
    () => this.commandesClients().filter((c) => c.statut === 'EN_ATTENTE').length,
  );

  protected readonly totalPainsCommandes = computed(() =>
    this.commandes()
      .filter((c) => c.statut !== 'ANNULEE')
      .reduce((acc, c) => acc + c.lignes.reduce((s, l) => s + l.quantite, 0), 0),
  );

  protected readonly totalLivrees = computed(
    () => this.commandes().filter((c) => c.statut === 'LIVREE').length,
  );

  protected readonly totalPainsLivres = computed(() =>
    this.commandes()
      .filter((c) => c.statut === 'LIVREE')
      .reduce((acc, c) => acc + c.lignes.reduce((s, l) => s + l.quantite, 0), 0),
  );

  protected readonly montantTotalCommandes = computed(() =>
    this.commandes()
      .filter((c) => c.statut !== 'ANNULEE')
      .reduce((acc, c) => acc + c.montantTotal, 0),
  );

  ngOnInit(): void {
    this.charger();
  }

  protected charger(): void {
    this.service
      .lister(this.dateFiltre() || undefined, this.statutFiltre() || undefined)
      .subscribe({
        next: (res) => {
          this.commandes.set(res);
          this.erreur.set(null);
        },
        error: (err) => this.erreur.set(messageErreur(err)),
      });
  }

  protected ouvrirCreation(mode: 'DIRECTE' | 'PRECOMMANDE' = 'DIRECTE'): void {
    this.modeDialogueInitial.set(mode);
    this.erreurDialogue.set(null);
    this.dialogueOuvert.set(true);
  }

  protected creerCommande(requete: CommandeCreationRequest): void {
    this.enregistrement.set(true);
    this.erreurDialogue.set(null);
    this.service.creer(requete).subscribe({
      next: (creee) => {
        if (requete.typeCommande === 'DIRECTE' && creee.montantTotal > 0) {
          const detailPains = (creee.lignes || [])
            .map((l) => `${l.quantite}x ${l.produitNom}`)
            .join(', ');
          this.paiementService
            .creer({
              montant: creee.montantTotal,
              modePaiement: 'ESPECES',
              remarques: `Vente de la caisse (${detailPains || 'Comptoir'}) - Caissier : ${creee.livreurNom || 'Employé'}`,
            })
            .subscribe({ error: () => {} });
        }
        this.enregistrement.set(false);
        this.dialogueOuvert.set(false);
        this.charger();
      },
      error: (err) => {
        this.enregistrement.set(false);
        this.erreurDialogue.set(messageErreur(err));
      },
    });
  }

  protected changerStatut(c: Commande, statut: StatutCommande): void {
    this.service.changerStatut(c.id, statut).subscribe({
      next: () => this.charger(),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected libelleStatut(s: StatutCommande): string {
    switch (s) {
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
        return 'En attente';
    }
  }

  protected estCommandeDirecte(c: Commande): boolean {
    return c.remarques?.includes('[DIRECTE]') ?? false;
  }

  /** Extrait le nom / les informations du client depuis le tag [CLIENT: ...] ou l'objet client rattaché. */
  protected nomClientAffiche(c: Commande): string {
    if (c.remarques) {
      const m = c.remarques.match(/\[CLIENT:\s*([^\]]+)\]/);
      if (m && m[1]?.trim()) {
        return m[1].trim();
      }
    }
    if (c.clientNomBoutique) {
      return c.clientNomBoutique;
    }
    return 'Client particulier';
  }

  protected texteRemarquesSansTag(c: Commande): string {
    if (!c.remarques) return '';
    return c.remarques
      .replace(/\[(DIRECTE|PRECOMMANDE)\]\s*/g, '')
      .replace(/\[CLIENT:\s*[^\]]+\]\s*/g, '')
      .trim();
  }
}
