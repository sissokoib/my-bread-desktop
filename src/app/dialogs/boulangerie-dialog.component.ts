import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Boulangerie, BoulangerieCreationRequest, PlanAbonnement } from '../models/utilisateur.model';
import { messageErreur } from '../services/message-erreur';
import { SuperAdminService } from '../services/super-admin.service';

@Component({
  selector: 'app-boulangerie-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" style="max-width: 580px" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>Créer une nouvelle Boulangerie (Client SaaS)</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 1rem">
          Chaque boulangerie créée dispose de son propre environnement isolé (son équipe, ses livreurs, ses livraisons et ses bilans).
        </p>

        <!-- 1. Informations de l'Établissement -->
        <div style="font-weight: 750; font-size: 0.9rem; color: var(--primary); margin-bottom: 0.6rem">
          1. Informations de la Boulangerie
        </div>

        <div class="field">
          <label for="nomBoulangerie">Nom de la Boulangerie</label>
          <input
            id="nomBoulangerie"
            name="nom"
            type="text"
            required
            [(ngModel)]="nom"
            placeholder="Ex. Boulangerie La Colombe d'Or"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="telBoulangerie">Téléphone principal</label>
            <input
              id="telBoulangerie"
              name="telephone"
              type="tel"
              required
              [(ngModel)]="telephone"
              placeholder="Ex. 70112233"
            />
          </div>

          <div class="field">
            <label for="planAbonnement">Plan d'abonnement</label>
            <select id="planAbonnement" name="plan" [(ngModel)]="plan">
              <option value="STARTER">Starter (Jusqu'à 2 livreurs)</option>
              <option value="PRO">Pro (Fournil complet)</option>
              <option value="RESEAU">Réseau Multi-Sites</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="adresseBoulangerie">Adresse / Quartier</label>
            <input
              id="adresseBoulangerie"
              name="adresse"
              type="text"
              [(ngModel)]="adresse"
              placeholder="Ex. Badalabougou, Bamako"
            />
          </div>

          <div class="field">
            <label for="dureeEssai">Période d'essai gratuit (jours)</label>
            <input
              id="dureeEssai"
              name="dureeEssai"
              type="number"
              min="1"
              max="90"
              [(ngModel)]="dureeEssaiJours"
            />
          </div>
        </div>

        <!-- 2. Compte Administrateur / Gérant Initial -->
        <div style="font-weight: 750; font-size: 0.9rem; color: var(--primary); margin: 1.2rem 0 0.6rem 0">
          2. Compte Administrateur / Gérant Initial
        </div>

        <div class="field">
          <label for="gerantNom">Nom complet du Gérant</label>
          <input
            id="gerantNom"
            name="gerantNom"
            type="text"
            required
            [(ngModel)]="gerantNom"
            placeholder="Ex. Amadou Diarra"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="gerantTel">Téléphone Gérant (Identifiant de connexion)</label>
            <input
              id="gerantTel"
              name="gerantTelephone"
              type="tel"
              required
              [(ngModel)]="gerantTelephone"
              placeholder="Ex. 76554433"
            />
          </div>

          <div class="field">
            <label for="gerantPass">Mot de passe initial</label>
            <input
              id="gerantPass"
              name="gerantMotDePasse"
              type="text"
              required
              [(ngModel)]="gerantMotDePasse"
              placeholder="Ex. pass1234"
            />
          </div>
        </div>

        <div class="field">
          <label for="contactCommercial">Votre contact pour renouvellement manuel (WhatsApp / Tel)</label>
          <input
            id="contactCommercial"
            name="contactCommercial"
            type="text"
            [(ngModel)]="contactCommercial"
            placeholder="+223 70 00 00 00"
          />
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Création en cours…' : 'Créer la Boulangerie et son Gérant' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class BoulangerieDialogComponent {
  private readonly service = inject(SuperAdminService);

  @Output() fermer = new EventEmitter<void>();
  @Output() enregistre = new EventEmitter<Boulangerie>();

  protected nom = '';
  protected telephone = '';
  protected adresse = '';
  protected plan: PlanAbonnement = 'PRO';
  protected dureeEssaiJours = 14;
  protected gerantNom = '';
  protected gerantTelephone = '';
  protected gerantMotDePasse = 'pass1234';
  protected contactCommercial = '+223 70 00 00 00';

  protected readonly erreur = signal<string | null>(null);
  protected readonly enCours = signal(false);

  protected enregistrer(): void {
    if (!this.nom.trim() || !this.telephone.trim() || !this.gerantTelephone.trim()) {
      this.erreur.set('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);

    const requete: BoulangerieCreationRequest = {
      nom: this.nom.trim(),
      telephone: this.telephone.trim(),
      adresse: this.adresse.trim() || undefined,
      plan: this.plan,
      dureeEssaiJours: this.dureeEssaiJours,
      gerantNom: this.gerantNom.trim(),
      gerantTelephone: this.gerantTelephone.trim(),
      gerantMotDePasse: this.gerantMotDePasse.trim(),
      contactCommercial: this.contactCommercial.trim() || undefined,
    };

    this.service.creerBoulangerie(requete).subscribe({
      next: (boulangerie) => {
        this.enCours.set(false);
        this.enregistre.emit(boulangerie);
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}

