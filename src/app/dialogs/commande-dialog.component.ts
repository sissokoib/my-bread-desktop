import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Client } from '../models/client.model';
import {
  CommandeCreationRequest,
  LigneQuantiteRequest,
  StockDisponible,
} from '../models/operations.model';
import { Produit } from '../models/produit.model';
import { Utilisateur } from '../models/utilisateur.model';
import { ClientService } from '../services/client.service';
import { CommandeService } from '../services/commande.service';
import { ProduitService } from '../services/produit.service';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-commande-dialog',
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog dialog-lg" style="max-width: 800px; width: 100%" (click)="$event.stopPropagation()" (ngSubmit)="valider()">
        <div class="dialog-header">
          <div>
            <h2>{{ modeCommande() === 'DIRECTE' ? 'Nouvelle vente de la caisse' : 'Nouvelle commande client' }}</h2>
            <p class="page-sub">
              {{ modeCommande() === 'DIRECTE'
                ? 'Enregistrez une vente faite directement à la caisse de la boulangerie.'
                : 'Enregistrez une commande passée à l\\'avance par un client (particulier, boutique, restaurant, événement).' }}
            </p>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreurLocale() || erreur()) {
          <div class="alert alert-error">{{ erreurLocale() || erreur() }}</div>
        }

        <!-- SÉLECTEUR DE TYPE : COMMANDE DIRECTE VS PRÉCOMMANDE -->
        <div class="field" style="margin-bottom: 0.5rem">
          <label style="font-weight: 700; margin-bottom: 0.4rem; display: block">Type de commande *</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem">
            <div
              (click)="changerMode('DIRECTE')"
              [style.borderColor]="modeCommande() === 'DIRECTE' ? '#8B5A2B' : '#E5E7EB'"
              [style.backgroundColor]="modeCommande() === 'DIRECTE' ? '#FDF8F3' : '#FFFFFF'"
              style="border: 2px solid; border-radius: 12px; padding: 0.75rem 0.95rem; cursor: pointer; display: flex; align-items: flex-start; gap: 0.75rem; transition: all 0.15s ease"
            >
              <div
                [style.background]="modeCommande() === 'DIRECTE' ? '#8B5A2B' : '#F3F4F6'"
                [style.color]="modeCommande() === 'DIRECTE' ? '#FFFFFF' : '#6B7280'"
                style="width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0"
              >
                <span class="material-symbols-outlined" style="font-size: 1.25rem">point_of_sale</span>
              </div>
              <div>
                <div style="font-weight: 800; font-size: 0.9rem; color: #1F2937">Vente de la caisse</div>
                <div style="font-size: 0.76rem; color: #6B7280; margin-top: 2px; line-height: 1.35">
                  Vente directe à un client au comptoir, prélevée sur le stock cuit disponible.
                </div>
              </div>
            </div>

            <div
              (click)="changerMode('PRECOMMANDE')"
              [style.borderColor]="modeCommande() === 'PRECOMMANDE' ? '#8B5A2B' : '#E5E7EB'"
              [style.backgroundColor]="modeCommande() === 'PRECOMMANDE' ? '#FDF8F3' : '#FFFFFF'"
              style="border: 2px solid; border-radius: 12px; padding: 0.75rem 0.95rem; cursor: pointer; display: flex; align-items: flex-start; gap: 0.75rem; transition: all 0.15s ease"
            >
              <div
                [style.background]="modeCommande() === 'PRECOMMANDE' ? '#8B5A2B' : '#F3F4F6'"
                [style.color]="modeCommande() === 'PRECOMMANDE' ? '#FFFFFF' : '#6B7280'"
                style="width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0"
              >
                <span class="material-symbols-outlined" style="font-size: 1.25rem">pending_actions</span>
              </div>
              <div>
                <div style="font-weight: 800; font-size: 0.9rem; color: #1F2937">Commande client</div>
                <div style="font-size: 0.76rem; color: #6B7280; margin-top: 2px; line-height: 1.35">
                  Commande passée à l'avance par un client, pour planifier les prochaines fournées.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- FORM GRID : CLIENT / CAISSIER / RESPONSABLE -->
        @if (modeCommande() === 'DIRECTE') {
          <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 0.85rem">
            <div class="field">
              <label for="cmd-caissier">Caissier *</label>
              <select id="cmd-caissier" name="livreurId" required [(ngModel)]="livreurId">
                <option [ngValue]="0" disabled>Choisir le caissier…</option>
                @for (e of employesDirects(); track e.id) {
                  <option [ngValue]="e.id">{{ e.nom }} ({{ e.telephone }})</option>
                }
                @if (employesDirects().length === 0) {
                  <option [ngValue]="0" disabled>Aucun employé direct disponible</option>
                }
              </select>
            </div>

            <div class="field">
              <label for="cmd-date">Date de la vente *</label>
              <input
                id="cmd-date"
                name="dateLivraisonSouhaitee"
                type="date"
                required
                [ngModel]="dateLivraisonSouhaitee"
                (ngModelChange)="auChangementDate($event)"
              />
            </div>
          </div>
        } @else {
          <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 0.85rem">
            <div class="field">
              <label for="cmd-client">Client / Destinataire *</label>
              <input
                id="cmd-client"
                name="clientNom"
                type="text"
                list="cmd-clients-connus"
                maxlength="160"
                [(ngModel)]="clientNom"
                placeholder="Nom du client ou ses informations (ex: Awa Diarra - 76 00 00 00)"
              />
              <datalist id="cmd-clients-connus">
                @for (c of clients(); track c.id) {
                  <option [value]="c.nomBoutique + (c.telephone ? ' (' + c.telephone + ')' : '')"></option>
                }
              </datalist>
            </div>

            <div class="field">
              <label for="cmd-livreur">Livreur / Responsable assigné *</label>
              <select id="cmd-livreur" name="livreurId" required [(ngModel)]="livreurId">
                <option [ngValue]="0" disabled>Choisir un employé direct…</option>
                @for (e of employesDirects(); track e.id) {
                  <option [ngValue]="e.id">{{ e.nom }} ({{ e.telephone }})</option>
                }
                @if (employesDirects().length === 0) {
                  <option [ngValue]="0" disabled>Aucun employé direct disponible</option>
                }
              </select>
            </div>
          </div>

          <div class="field" style="margin-top: 0.5rem">
            <label for="cmd-date">Date de livraison souhaitée *</label>
            <input
              id="cmd-date"
              name="dateLivraisonSouhaitee"
              type="date"
              required
              [ngModel]="dateLivraisonSouhaitee"
              (ngModelChange)="auChangementDate($event)"
            />
          </div>
        }

        <!-- SECTION PRODUITS & STOCK DISPONIBLE -->
        <div style="flex-shrink: 0; width: 100%">
          <div style="font-weight: 700; font-size: 0.92rem; color: var(--text); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between">
            <span style="display: flex; align-items: center; gap: 0.4rem">
              <span class="material-symbols-outlined" style="font-size: 1.2rem; color: #DEAB38">bakery_dining</span>
              Pains à commander *
            </span>
            @if (produits().length > 0) {
              <span style="font-size: 0.78rem; color: var(--text-secondary); font-weight: 500">
                {{ produits().length }} type(s) de pain disponible(s)
              </span>
            }
          </div>

          @if (chargement()) {
            <div style="padding: 1.5rem; text-align: center; background: #F9FAFB; border-radius: 12px; border: 1px dashed var(--border); color: #6B7280; font-size: 0.85rem">
              <span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 0.35rem">sync</span>
              Chargement des pains disponibles…
            </div>
          } @else if (produits().length === 0) {
            <div style="padding: 1.5rem; text-align: center; background: #F9FAFB; border-radius: 12px; border: 1.5px dashed var(--border); color: #6B7280">
              <span class="material-symbols-outlined" style="font-size: 2rem; color: #9CA3AF; display: block; margin-bottom: 0.35rem">inventory_2</span>
              <strong>Aucun produit actif disponible</strong>
              <div style="font-size: 0.8rem; margin-top: 0.25rem">
                Veuillez configurer et activer des produits dans la rubrique « Produits ».
              </div>
            </div>
          } @else {
            <div class="table-wrap" style="flex-shrink: 0; width: 100%; border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; background: var(--surface)">
              <table style="width: 100%; min-width: 540px; border-collapse: collapse">
                <thead>
                  <tr>
                    <th style="padding: 0.65rem 0.85rem">Pain / Produit</th>
                    <th class="num" style="padding: 0.65rem 0.85rem">Prix unitaire</th>
                    <th style="text-align: center; padding: 0.65rem 0.85rem">Stock au fournil</th>
                    <th class="num" style="width: 240px; padding: 0.65rem 0.85rem">Quantité demandée</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of produits(); track p.id) {
                    <tr>
                      <td style="font-weight: 700; padding: 0.65rem 0.85rem">
                        <div style="display: flex; align-items: center; gap: 0.45rem">
                          <span class="material-symbols-outlined" style="font-size: 1.15rem; color: #DEAB38">bakery_dining</span>
                          <span>{{ p.nom }}</span>
                        </div>
                      </td>
                      <td class="num" style="padding: 0.65rem 0.85rem; font-weight: 600">{{ p.prixVente | number }} F</td>
                      <td style="text-align: center; padding: 0.65rem 0.85rem">
                        @if (stocks()[p.id]; as st) {
                          @if (st.stockDisponible <= 0) {
                            <span class="badge badge-warn" style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; padding: 0.2rem 0.5rem; border-radius: 6px">
                              <span class="material-symbols-outlined" style="font-size: 0.95rem">remove_shopping_cart</span>
                              0 en rayon
                            </span>
                            <div class="field-hint" style="font-size: 0.72rem; margin-top: 2px">
                              Cuit : {{ st.quantiteProduite }} · Déjà pris : {{ st.quantiteCommandee }}
                            </div>
                          } @else {
                            <span class="badge badge-ok" style="background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px; padding: 0.2rem 0.5rem; border-radius: 6px">
                              <span class="material-symbols-outlined" style="font-size: 0.95rem">check_circle</span>
                              {{ st.stockDisponible }} dispo(s)
                            </span>
                            <div class="field-hint" style="font-size: 0.72rem; margin-top: 2px">
                              Cuit/Retour : {{ st.quantiteProduite }} · Déjà pris : {{ st.quantiteCommandee }}
                            </div>
                          }
                        } @else {
                          <span class="field-hint">Chargement stock…</span>
                        }
                      </td>
                      <td class="num" style="padding: 0.65rem 0.85rem">
                        <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: flex-end">
                          <input
                            type="number"
                            min="0"
                            [name]="'qte_' + p.id"
                            [(ngModel)]="quantites[p.id]"
                            (ngModelChange)="erreurLocale.set(null)"
                            [style.borderColor]="estEnDepassement(p.id) ? (modeCommande() === 'DIRECTE' ? '#DC2626' : '#F59E0B') : null"
                            [style.backgroundColor]="estEnDepassement(p.id) ? (modeCommande() === 'DIRECTE' ? '#FEF2F2' : '#FFFBEB') : null"
                            style="width: 90px; text-align: right; font-weight: 700; padding: 0.4rem 0.55rem"
                          />
                          <span style="font-size: 0.8rem; color: #6B7280; font-weight: 600">pains</span>
                        </div>
                        <!-- Pavé tactile rapide (+1, +5, +10, +20, 0) -->
                        <div style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 5px; flex-wrap: wrap">
                          <button type="button" (click)="ajouterQuantiteRapide(p.id, 1)" style="border: 1px solid #D1D5DB; background: #F9FAFB; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #1F2937">+1</button>
                          <button type="button" (click)="ajouterQuantiteRapide(p.id, 5)" style="border: 1px solid #D1D5DB; background: #F9FAFB; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #1F2937">+5</button>
                          <button type="button" (click)="ajouterQuantiteRapide(p.id, 10)" style="border: 1px solid #D1D5DB; background: #F9FAFB; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #1F2937">+10</button>
                          <button type="button" (click)="ajouterQuantiteRapide(p.id, 20)" style="border: 1px solid #D1D5DB; background: #F9FAFB; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #1F2937">+20</button>
                          @if ((quantites[p.id] || 0) > 0) {
                            <button type="button" (click)="reinitialiserQuantiteProduit(p.id)" style="border: 1px solid #FECACA; background: #FEF2F2; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #DC2626">0</button>
                          }
                        </div>
                        @if (estEnDepassement(p.id)) {
                          <div
                            [style.color]="modeCommande() === 'DIRECTE' ? '#DC2626' : '#D97706'"
                            style="font-size: 0.72rem; font-weight: 700; margin-top: 3px; display: flex; align-items: center; justify-content: flex-end; gap: 3px"
                          >
                            <span class="material-symbols-outlined" style="font-size: 0.9rem">{{ modeCommande() === 'DIRECTE' ? 'error' : 'info' }}</span>
                            <span>{{ modeCommande() === 'DIRECTE' ? 'Dépasse stock (' + getStockDispo(p.id) + ' dispo)' : 'À cuire (' + getStockDispo(p.id) + ' dispo)' }}</span>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- RÉCAPITULATIF SOUS LE TABLEAU -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.65rem 1rem; margin-top: 0.5rem">
              <span style="font-size: 0.85rem; color: #475569; font-weight: 600">
                Total : <strong style="color: #0F172A; font-size: 0.95rem">{{ totalPains() }} pains</strong>
              </span>
              <span style="font-size: 0.85rem; color: #475569; font-weight: 600">
                Montant à payer : <strong style="color: #8B5A2B; font-size: 1.05rem">{{ montantTotal() | number }} FCFA</strong>
              </span>
            </div>
          }
        </div>

        <!-- AVERTISSEMENT EN MODE PRÉCOMMANDE -->
        @if (modeCommande() === 'PRECOMMANDE' && aDesDepassements()) {
          <div style="background: #FFFBEB; border: 1.5px solid #FCD34D; border-radius: 10px; padding: 0.75rem 1rem; margin-top: 0.25rem; display: flex; align-items: flex-start; gap: 0.75rem">
            <span class="material-symbols-outlined" style="color: #D97706; font-size: 1.35rem; margin-top: 1px">pending_actions</span>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #92400E">
                Information : Commande supérieure au stock actuel
              </div>
              <div style="font-size: 0.82rem; color: #B45309; margin-top: 2px; line-height: 1.4">
                La quantité saisie dépasse la réserve immédiatement prête. Elle est enregistrée en <strong>commande client</strong> pour planifier les prochaines fournées du chef boulanger.
              </div>
            </div>
          </div>
        }

        <div class="field" style="margin-top: 0.25rem">
          <label for="cmd-rem">Remarques / instructions de commande</label>
          <input
            id="cmd-rem"
            name="remarques"
            type="text"
            [(ngModel)]="remarques"
            [placeholder]="modeCommande() === 'DIRECTE' ? 'Ex. Client de passage, paiement en espèces' : 'Ex. Prévoir pour la première fournée de 06h00'"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-ghost" (click)="fermer.emit()">Annuler</button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="enCours() || !livreurId"
            [style.background]="modeCommande() === 'DIRECTE' && aDesDepassements() ? '#DC2626' : null"
          >
            {{ enCours() ? 'Enregistrement…' : (modeCommande() === 'DIRECTE' ? 'Valider la vente de la caisse' : (aDesDepassements() ? 'Confirmer la commande client (À produire)' : 'Enregistrer la commande client')) }}
          </button>
        </div>
      </form>
    </div>

    <!-- ====================================================================
         POPUP MODAL BLOQUANT : STOCK INSUFFISANT (COMMANDE DIRECTE)
         ==================================================================== -->
    @if (popupStockInsuffisantOuvert()) {
      <div class="backdrop" style="z-index: 1050; background: rgba(0, 0, 0, 0.65)" (click)="fermerPopupStock()">
        <div
          class="dialog"
          style="max-width: 500px; border-radius: 18px; border: 2px solid #FCA5A5; box-shadow: 0 20px 25px -5px rgba(220, 38, 38, 0.2)"
          (click)="$event.stopPropagation()"
        >
          <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0">
              <span class="material-symbols-outlined" style="font-size: 1.6rem">inventory_2</span>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; color: #991B1B; font-weight: 800">
                Stock insuffisant au fournil
              </h3>
              <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #7F1D1D">
                La vente de la caisse ne peut pas être servie sur le stock actuel.
              </p>
            </div>
          </div>

          <div style="background: #FFF5F5; border: 1px solid #FECACA; border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1.1rem">
            <div style="font-size: 0.83rem; color: #7F1D1D; line-height: 1.45">
              Le caissier <strong>{{ getNomLivreurSelectionne() }}</strong> veut vendre du pain immédiatement, mais la réserve cuite en rayon ne suffit pas :
            </div>
            <ul style="margin: 0.5rem 0 0.5rem 1.1rem; padding: 0; font-size: 0.82rem; color: #991B1B">
              @for (prod of getProduitsEnDepassement(); track prod.id) {
                <li style="margin-bottom: 4px">
                  <strong>{{ prod.nom }}</strong> : Demandé : <strong>{{ quantites[prod.id] }}</strong> | Disponible en rayon : <strong style="color: #059669">{{ getStockDispo(prod.id) }}</strong> (Manque : {{ quantites[prod.id] - getStockDispo(prod.id) }})
                </li>
              }
            </ul>
            <div style="font-size: 0.78rem; color: #6B7280; margin-top: 6px; border-top: 1px dashed #FCA5A5; padding-top: 6px">
              Pour une vente de la caisse, vous ne pouvez pas vendre plus que le stock disponible. Vous pouvez ajuster la quantité ou enregistrer une commande client pour la prochaine fournée.
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.6rem">
            <button
              type="button"
              class="btn-primary"
              style="width: 100%; justify-content: center; background: #059669"
              (click)="ajusterAuStockDisponible()"
            >
              <span class="material-symbols-outlined" style="font-size: 1.1rem; margin-right: 4px">check_circle</span>
              Ajuster automatiquement au stock disponible
            </button>

            <button
              type="button"
              class="btn-secondary"
              style="width: 100%; justify-content: center"
              (click)="basculerEnPrecommande()"
            >
              <span class="material-symbols-outlined" style="font-size: 1.1rem; margin-right: 4px">pending_actions</span>
              Basculer en Commande client (À cuire)
            </button>

            <button
              type="button"
              class="btn-ghost"
              style="width: 100%; justify-content: center; font-size: 0.8rem"
              (click)="fermerPopupStock()"
            >
              Modifier manuellement les quantités
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandeDialogComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly utilisateurService = inject(UtilisateurService);
  private readonly produitService = inject(ProduitService);
  private readonly commandeService = inject(CommandeService);

  readonly enCours = input(false);
  readonly erreur = input<string | null>(null);
  readonly modeInitial = input<'DIRECTE' | 'PRECOMMANDE'>('DIRECTE');
  readonly enregistrer = output<CommandeCreationRequest>();
  readonly fermer = output<void>();

  protected readonly modeCommande = signal<'DIRECTE' | 'PRECOMMANDE'>('DIRECTE');
  protected readonly popupStockInsuffisantOuvert = signal(false);

  protected readonly clients = signal<Client[]>([]);
  /** Employés directs de la boulangerie (caissiers / responsables) — les livreurs externes sont exclus. */
  protected readonly employesDirects = signal<Utilisateur[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly stocks = signal<Record<number, StockDisponible>>({});
  protected readonly erreurLocale = signal<string | null>(null);
  protected readonly chargement = signal(true);

  protected clientNom = '';
  protected clientInfos = '';
  protected livreurId = 0;
  protected dateLivraisonSouhaitee = new Date().toISOString().slice(0, 10);
  protected quantites: Record<number, number> = {};
  protected montantRemisClient: number | null = null;
  protected remarques = '';

  protected ajouterQuantiteRapide(produitId: number, ajout: number): void {
    const actuel = Number(this.quantites[produitId] || 0);
    this.quantites[produitId] = Math.max(0, actuel + ajout);
    this.erreurLocale.set(null);
  }

  protected reinitialiserQuantiteProduit(produitId: number): void {
    this.quantites[produitId] = 0;
    this.erreurLocale.set(null);
  }

  ngOnInit(): void {
    this.modeCommande.set(this.modeInitial());
    if (this.modeInitial() === 'PRECOMMANDE') {
      this.dateLivraisonSouhaitee = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    }
    this.clientService.lister().subscribe({
      next: (cls) => this.clients.set(cls.filter((c) => c.actif)),
      error: () => {},
    });

    this.utilisateurService.lister().subscribe({
      next: (users) => {
        const employes = users.filter(
          (u) => u.actif && (u.role === 'EMPLOYE' || u.role === 'GESTIONNAIRE' || u.role === 'ADMIN'),
        );
        this.employesDirects.set(employes);
        this.livreurId = employes.length > 0 ? employes[0].id : 0;
      },
      error: () => {},
    });

    this.produitService.lister().subscribe({
      next: (p) => {
        this.chargement.set(false);
        const actifs = p.filter((x) => x.actif);
        this.produits.set(actifs);
        for (const prod of actifs) {
          if (this.quantites[prod.id] === undefined) {
            this.quantites[prod.id] = 0;
          }
        }
        this.chargerStocks();
      },
      error: () => {
        this.chargement.set(false);
      },
    });
  }

  protected totalPains(): number {
    return Object.values(this.quantites).reduce((acc, q) => acc + (Number(q) || 0), 0);
  }

  protected montantTotal(): number {
    return this.produits().reduce((acc, p) => {
      const q = Number(this.quantites[p.id] || 0);
      return acc + q * p.prixVente;
    }, 0);
  }

  protected changerMode(mode: 'DIRECTE' | 'PRECOMMANDE'): void {
    this.modeCommande.set(mode);
    this.erreurLocale.set(null);
    if (mode === 'DIRECTE') {
      this.dateLivraisonSouhaitee = new Date().toISOString().slice(0, 10);
    } else {
      this.dateLivraisonSouhaitee = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    }
    this.chargerStocks();
  }

  protected auChangementDate(nouvelleDate: string): void {
    this.dateLivraisonSouhaitee = nouvelleDate;
    this.erreurLocale.set(null);
    this.chargerStocks();
  }

  protected chargerStocks(): void {
    this.commandeService.stockDisponible(this.dateLivraisonSouhaitee).subscribe({
      next: (res) => {
        const map: Record<number, StockDisponible> = {};
        for (const item of res) {
          map[item.produitId] = item;
        }
        this.stocks.set(map);
      },
      error: () => {},
    });
  }

  protected getStockDispo(produitId: number): number {
    return this.stocks()[produitId]?.stockDisponible ?? 0;
  }

  protected estEnDepassement(produitId: number): boolean {
    const qte = Number(this.quantites[produitId] || 0);
    if (qte <= 0) return false;
    const dispo = this.getStockDispo(produitId);
    return qte > dispo;
  }

  protected aDesDepassements(): boolean {
    for (const [idStr, val] of Object.entries(this.quantites)) {
      const q = Number(val || 0);
      if (q > 0) {
        const dispo = this.getStockDispo(Number(idStr));
        if (q > dispo) return true;
      }
    }
    return false;
  }

  protected getProduitsEnDepassement(): Produit[] {
    return this.produits().filter((p) => this.estEnDepassement(p.id));
  }

  protected getNomLivreurSelectionne(): string {
    const l = this.employesDirects().find((x) => x.id === this.livreurId);
    return l ? l.nom : 'sélectionné';
  }

  protected fermerPopupStock(): void {
    this.popupStockInsuffisantOuvert.set(false);
  }

  protected ajusterAuStockDisponible(): void {
    for (const prod of this.getProduitsEnDepassement()) {
      this.quantites[prod.id] = this.getStockDispo(prod.id);
    }
    this.popupStockInsuffisantOuvert.set(false);
  }

  protected basculerEnPrecommande(): void {
    this.modeCommande.set('PRECOMMANDE');
    this.popupStockInsuffisantOuvert.set(false);
  }

  protected valider(): void {
    this.erreurLocale.set(null);
    const lignes: LigneQuantiteRequest[] = Object.entries(this.quantites)
      .map(([id, q]) => ({ produitId: Number(id), quantite: Number(q) }))
      .filter((l) => l.quantite > 0);

    const estVente = this.modeCommande() === 'DIRECTE';

    if (!this.livreurId) {
      this.erreurLocale.set(estVente ? 'Veuillez sélectionner le caissier.' : 'Veuillez sélectionner le responsable assigné.');
      return;
    }
    const nomClient = this.clientNom.trim();
    if (!estVente && !nomClient) {
      this.erreurLocale.set('Veuillez saisir le nom du client.');
      return;
    }
    if (lignes.length === 0) {
      this.erreurLocale.set('Veuillez saisir une quantité supérieure à 0 pour au moins un produit.');
      return;
    }

    // SI VENTE DE LA CAISSE ET DÉPASSEMENT : OUVERTURE DU POPUP D'ALERTE BLOQUANT
    if (estVente && this.aDesDepassements()) {
      this.popupStockInsuffisantOuvert.set(true);
      return;
    }

    // Commande client : si le nom correspond à un client enregistré, on le rattache (prix spécifiques),
    // sinon on mémorise le nom et les informations saisies dans un marqueur [CLIENT: ...].
    let clientId: number | null = null;
    let remarques = this.remarques.trim();
    if (!estVente) {
      const connu = this.clients().find((c) => c.nomBoutique.trim().toLowerCase() === nomClient.toLowerCase());
      clientId = connu ? connu.id : null;
      const infos = this.clientInfos.trim();
      const tagClient = `[CLIENT: ${nomClient}${infos ? ' · ' + infos : ''}]`;
      remarques = `${tagClient} ${remarques}`.trim();
    }

    this.enregistrer.emit({
      clientId,
      livreurId: this.livreurId,
      dateLivraisonSouhaitee: this.dateLivraisonSouhaitee,
      lignes,
      remarques: remarques || null,
      typeCommande: this.modeCommande(),
    });
  }
}
