import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Client } from '../models/client.model';
import { Zone } from '../models/zone.model';
import { ClientService } from '../services/client.service';
import { messageErreur } from '../services/message-erreur';

@Component({
  selector: 'app-client-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>{{ client ? 'Modifier le boutiquier' : 'Nouveau boutiquier' }}</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="form-grid">
          <div class="field">
            <label for="nomBoutique">Nom de la boutique *</label>
            <input
              id="nomBoutique"
              name="nomBoutique"
              type="text"
              required
              maxlength="150"
              [(ngModel)]="nomBoutique"
              placeholder="Ex. Boutique Fanta"
            />
          </div>

          <div class="field">
            <label for="nomResponsable">Nom du responsable</label>
            <input
              id="nomResponsable"
              name="nomResponsable"
              type="text"
              maxlength="120"
              [(ngModel)]="nomResponsable"
              placeholder="Ex. Fanta Traoré"
            />
          </div>

          <div class="field">
            <label for="telephoneClient">Téléphone *</label>
            <input
              id="telephoneClient"
              name="telephone"
              type="tel"
              required
              maxlength="30"
              [(ngModel)]="telephone"
              placeholder="Ex. 76 11 22 33"
            />
          </div>

          <div class="field">
            <label for="zoneClient">Zone / quartier</label>
            <select id="zoneClient" name="zoneId" [(ngModel)]="zoneId">
              <option [ngValue]="null">— Aucune zone —</option>
              @for (z of zones; track z.id) {
                <option [ngValue]="z.id">{{ z.nom }}</option>
              }
            </select>
          </div>
        </div>

        <div class="field">
          <label for="adresseClient">Adresse ou repère</label>
          <input
            id="adresseClient"
            name="adresse"
            type="text"
            maxlength="255"
            [(ngModel)]="adresse"
            placeholder="Ex. Près du marché, face à la pharmacie…"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="plafondCredit">Plafond de crédit (FCFA)</label>
            <input
              id="plafondCredit"
              name="plafondCredit"
              type="number"
              min="0"
              step="500"
              [(ngModel)]="plafondCredit"
              placeholder="Laisser vide = aucun plafond"
            />
            <span class="field-hint">
              Dette maximale autorisée. Vide = pas de limite.
            </span>
          </div>

          <div class="field">
            <label for="mdpBoutiquier">Mot de passe mobile du boutiquier</label>
            <input
              id="mdpBoutiquier"
              name="motDePasse"
              type="password"
              maxlength="100"
              [(ngModel)]="motDePasse"
              [placeholder]="client ? 'Laisser vide pour ne pas changer' : 'Par défaut : 12345678'"
            />
            <span class="field-hint">
              Permet au boutiquier de se connecter sur l'application mobile avec son téléphone.
            </span>
          </div>
        </div>

        <label class="checkbox-line">
          <input type="checkbox" name="actif" [(ngModel)]="actif" />
          Boutiquier actif
        </label>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ClientDialogComponent implements OnInit {
  private readonly service = inject(ClientService);

  @Input() client: Client | null = null;
  @Input() zones: Zone[] = [];
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Client>();

  protected nomBoutique = '';
  protected nomResponsable = '';
  protected telephone = '';
  protected zoneId: number | null = null;
  protected adresse = '';
  protected plafondCredit: number | null = null;
  protected motDePasse = '';
  protected actif = true;
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    if (this.client) {
      this.nomBoutique = this.client.nomBoutique;
      this.nomResponsable = this.client.nomResponsable ?? '';
      this.telephone = this.client.telephone;
      this.zoneId = this.client.zoneId;
      this.adresse = this.client.adresse ?? '';
      this.plafondCredit = this.client.plafondCredit;
      this.actif = this.client.actif;
    }
  }

  protected enregistrer(): void {
    const nomBoutique = this.nomBoutique.trim();
    const telephone = this.telephone.trim();
    if (!nomBoutique || !telephone) {
      this.erreur.set('Le nom de la boutique et le téléphone sont obligatoires.');
      return;
    }
    const payload = {
      nomBoutique,
      nomResponsable: this.nomResponsable.trim() || null,
      telephone,
      zoneId: this.zoneId,
      adresse: this.adresse.trim() || null,
      plafondCredit:
        this.plafondCredit === null || this.plafondCredit === undefined
          ? null
          : Math.round(this.plafondCredit),
      actif: this.actif,
      motDePasse: this.motDePasse.trim() || null,
    };
    this.enCours.set(true);
    this.erreur.set(null);
    const requete = this.client
      ? this.service.modifier(this.client.id, payload)
      : this.service.creer(payload);
    requete.subscribe({
      next: (resultat) => {
        this.enCours.set(false);
        this.enregistre.emit(resultat);
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}

