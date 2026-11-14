import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Utilisateur } from '../models/utilisateur.model';
import { messageErreur } from '../services/message-erreur';
import { UtilisateurService } from '../services/utilisateur.service';

@Component({
  selector: 'app-mot-de-passe-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>Nouveau mot de passe pour {{ utilisateur.nom }}</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="nouveauMdp">Nouveau mot de passe (8 caractères minimum)</label>
          <input
            id="nouveauMdp"
            name="motDePasse"
            type="password"
            required
            minlength="8"
            [(ngModel)]="motDePasse"
          />
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn-secondary" (click)="fermer.emit()">Annuler</button>
          <button type="submit" class="btn-primary" [disabled]="enCours()">
            {{ enCours() ? 'Enregistrement…' : 'Changer le mot de passe' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class MotDePasseDialogComponent {
  private readonly service = inject(UtilisateurService);

  @Input({ required: true }) utilisateur!: Utilisateur;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<void>();

  protected motDePasse = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected enregistrer(): void {
    if (this.motDePasse.length < 8) {
      this.erreur.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    this.service.changerMotDePasse(this.utilisateur.id, this.motDePasse).subscribe({
      next: () => {
        this.enCours.set(false);
        this.enregistre.emit();
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}

