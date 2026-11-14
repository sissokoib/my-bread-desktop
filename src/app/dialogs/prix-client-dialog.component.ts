import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Client, PrixClient } from '../models/client.model';
import { ClientService } from '../services/client.service';
import { messageErreur } from '../services/message-erreur';

@Component({
  selector: 'app-prix-client-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <div class="dialog dialog-lg" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <div>
            <h2>Tarifs de {{ client.nomBoutique }}</h2>
            <p class="page-sub">
              Un prix spécial remplace le prix standard pour ce boutiquier lors des livraisons.
            </p>
          </div>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th class="num">Prix standard</th>
                <th class="num">Prix appliqué</th>
                <th class="num">Nouveau prix (FCFA)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (ligne of lignes(); track ligne.produitId) {
                <tr>
                  <td>
                    <strong>{{ ligne.produitNom }}</strong>
                    @if (ligne.prixSpecial !== null) {
                      <span class="badge badge-accent">Spécial</span>
                    }
                  </td>
                  <td class="num">{{ ligne.prixStandard | number }} FCFA</td>
                  <td class="num">
                    <strong>{{ ligne.prixApplique | number }} FCFA</strong>
                  </td>
                  <td class="num">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      style="width: 115px"
                      [(ngModel)]="saisies[ligne.produitId]"
                    />
                  </td>
                  <td class="actions">
                    <button
                      type="button"
                      class="btn-primary btn-sm"
                      [disabled]="enCours()"
                      (click)="appliquer(ligne)"
                    >
                      Appliquer
                    </button>
                    @if (ligne.prixSpecial !== null) {
                      <button
                        type="button"
                        class="btn-secondary btn-sm"
                        [disabled]="enCours()"
                        (click)="reinitialiser(ligne)"
                      >
                        Prix standard
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty">Aucun produit actif.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class PrixClientDialogComponent implements OnInit {
  private readonly service = inject(ClientService);

  @Input({ required: true }) client!: Client;
  @Output() readonly fermer = new EventEmitter<void>();

  protected readonly lignes = signal<PrixClient[]>([]);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected saisies: Record<number, number> = {};

  ngOnInit(): void {
    this.charger();
  }

  protected appliquer(ligne: PrixClient): void {
    const valeur = this.saisies[ligne.produitId];
    if (valeur === undefined || valeur === null || valeur < 0) {
      this.erreur.set('Indiquez un prix valide (0 ou plus).');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.definirPrix(this.client.id, ligne.produitId, Math.round(valeur)).subscribe({
      next: () => this.charger(),
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected reinitialiser(ligne: PrixClient): void {
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.supprimerPrix(this.client.id, ligne.produitId).subscribe({
      next: () => this.charger(),
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  private charger(): void {
    this.service.listerPrix(this.client.id).subscribe({
      next: (lignes) => {
        this.lignes.set(lignes);
        this.saisies = {};
        for (const l of lignes) {
          this.saisies[l.produitId] = l.prixApplique;
        }
        this.enCours.set(false);
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}

