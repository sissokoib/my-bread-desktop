import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Boulangerie, Role, Utilisateur } from '../models/utilisateur.model';
import { AuthService } from '../services/auth.service';
import { messageErreur } from '../services/message-erreur';
import { SuperAdminService } from '../services/super-admin.service';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-utilisateur-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>{{ utilisateur ? "Modifier l'utilisateur" : 'Nouvel utilisateur' }}</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="nomUtilisateur">Nom complet</label>
          <input
            id="nomUtilisateur"
            name="nom"
            type="text"
            required
            maxlength="120"
            [(ngModel)]="nom"
            placeholder="Ex. Moussa Coulibaly"
          />
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="telUtilisateur">Téléphone (identifiant de connexion)</label>
            <input
              id="telUtilisateur"
              name="telephone"
              type="tel"
              required
              maxlength="30"
              [(ngModel)]="telephone"
              placeholder="Ex. 75000001"
            />
          </div>

          <div class="field">
            <label for="roleUtilisateur">Rôle</label>
            <select id="roleUtilisateur" name="role" [(ngModel)]="role">
              <option value="ADMIN">Gérant (Fournil / Web)</option>
              <option value="PDG">PDG (Direction / Mobile)</option>
              <option value="LIVREUR">Livreur</option>
            </select>
          </div>
        </div>

        <!-- SÉLECTION OBLIGATOIRE DE LA BOULANGERIE -->
        <div class="field">
          <label for="boulangerieUtilisateur">Boulangerie rattachée *</label>
          <select
            id="boulangerieUtilisateur"
            name="boulangerieId"
            [(ngModel)]="boulangerieId"
            required
          >
            <option [ngValue]="null">-- Sélectionner la boulangerie --</option>
            @for (b of listeBoulangeries(); track b.id) {
              <option [ngValue]="b.id">{{ b.nom }} ({{ b.telephone }})</option>
            }
          </select>
          <p style="margin: 0.35rem 0 0 0; font-size: 0.78rem; color: var(--text-secondary)">
            ⚠️ Les données (fournées, caisse, tournées, stocks de farine) de ce compte seront strictement cantonnées à cette boulangerie.
          </p>
        </div>

        @if (!utilisateur) {
          <div class="field">
            <label for="mdpInitial">Mot de passe initial (8 caractères minimum)</label>
            <input
              id="mdpInitial"
              name="motDePasse"
              type="password"
              required
              minlength="8"
              [(ngModel)]="motDePasse"
            />
          </div>
        } @else {
          <label class="checkbox-line">
            <input type="checkbox" name="actif" [(ngModel)]="actif" />
            Compte actif (peut se connecter)
          </label>
        }

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
export class UtilisateurDialogComponent implements OnInit {
  private readonly service = inject(UtilisateurService);
  private readonly superAdminService = inject(SuperAdminService);
  private readonly auth = inject(AuthService);

  @Input() utilisateur: Utilisateur | null = null;
  @Input() boulangeriesDisponibles?: Boulangerie[];
  @Input() boulangerieIdPreselectionne?: number | null = null;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Utilisateur>();

  protected nom = '';
  protected telephone = '';
  protected role: Role = 'LIVREUR';
  protected boulangerieId: number | null = null;
  protected motDePasse = '';
  protected actif = true;
  protected readonly listeBoulangeries = signal<Boulangerie[]>([]);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    if (this.utilisateur) {
      this.nom = this.utilisateur.nom;
      this.telephone = this.utilisateur.telephone;
      this.role = this.utilisateur.role;
      this.actif = this.utilisateur.actif;
      this.boulangerieId = this.utilisateur.boulangerieId ?? null;
    } else if (this.boulangerieIdPreselectionne) {
      this.boulangerieId = this.boulangerieIdPreselectionne;
    } else {
      const connecte = this.auth.utilisateur();
      if (connecte?.boulangerieId) {
        this.boulangerieId = connecte.boulangerieId;
      }
    }

    if (this.boulangeriesDisponibles && this.boulangeriesDisponibles.length > 0) {
      this.listeBoulangeries.set(this.boulangeriesDisponibles);
    } else {
      this.superAdminService.listerBoulangeries().subscribe({
        next: (boulangeries) => {
          this.listeBoulangeries.set(boulangeries);
          if (!this.boulangerieId && boulangeries.length === 1) {
            this.boulangerieId = boulangeries[0].id;
          }
        },
        error: () => {
          const user = this.auth.utilisateur();
          if (user?.boulangerieId && user.boulangerieNom) {
            this.listeBoulangeries.set([
              {
                id: user.boulangerieId,
                nom: user.boulangerieNom,
                telephone: '',
                plan: 'PRO',
                statutAbonnement: 'ACTIF',
                dateCreation: '',
                dateFinAbonnement: '',
                joursRestants: 30,
                expire: false,
                actif: true,
                nbLivreurs: 0,
                nbClients: 0,
                caTotal: 0,
              },
            ]);
            this.boulangerieId = user.boulangerieId;
          }
        },
      });
    }
  }

  protected enregistrer(): void {
    const nom = this.nom.trim();
    const telephone = this.telephone.trim();
    if (!nom || !telephone) {
      this.erreur.set('Le nom et le téléphone sont obligatoires.');
      return;
    }
    if (!this.utilisateur && this.motDePasse.length < 8) {
      this.erreur.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!this.boulangerieId && this.role !== 'SUPER_ADMIN') {
      this.erreur.set('Veuillez sélectionner la boulangerie à laquelle ce compte est rattaché.');
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);
    const requete = this.utilisateur
      ? this.service.modifier(this.utilisateur.id, {
          nom,
          telephone,
          role: this.role,
          actif: this.actif,
          boulangerieId: this.boulangerieId,
        })
      : this.service.creer({
          nom,
          telephone,
          motDePasse: this.motDePasse,
          role: this.role,
          boulangerieId: this.boulangerieId,
        });

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
