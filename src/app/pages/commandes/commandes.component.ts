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

@Component({
  selector: 'app-commandes',
  imports: [FormsModule, DecimalPipe, CommandeDialogComponent],
  templateUrl: './commandes.component.html',
  styleUrl: './commandes.component.css',
})
export class CommandesComponent implements OnInit {
  private readonly service = inject(CommandeService);

  protected readonly commandes = signal<Commande[]>([]);
  protected readonly dateFiltre = signal('');
  protected readonly statutFiltre = signal<StatutCommande | ''>('');
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogueOuvert = signal(false);
  protected readonly enregistrement = signal(false);
  protected readonly erreurDialogue = signal<string | null>(null);

  protected readonly totalEnAttente = computed(
    () => this.commandes().filter((c) => c.statut === 'EN_ATTENTE').length,
  );

  protected readonly totalPainsCommandes = computed(() =>
    this.commandes()
      .filter((c) => c.statut !== 'ANNULEE')
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

  protected ouvrirCreation(): void {
    this.erreurDialogue.set(null);
    this.dialogueOuvert.set(true);
  }

  protected creerCommande(requete: CommandeCreationRequest): void {
    this.enregistrement.set(true);
    this.erreurDialogue.set(null);
    this.service.creer(requete).subscribe({
      next: () => {
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
      case 'LIVREE':
        return 'Validée';
      case 'ANNULEE':
        return 'Annulée';
      default:
        return 'En attente';
    }
  }
}

