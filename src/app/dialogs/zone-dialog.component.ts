import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Zone } from '../models/zone.model';
import { messageErreur } from '../services/message-erreur';
import { ZoneService } from '../services/zone.service';

@Component({
  selector: 'app-zone-dialog',
  imports: [FormsModule],
  template: `
    <div class="backdrop" (click)="fermer.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="enregistrer()">
        <div class="dialog-header">
          <h2>{{ zone ? 'Modifier la zone' : 'Nouvelle zone' }}</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="fermer.emit()">Fermer</button>
        </div>

        @if (erreur()) {
          <div class="alert alert-error">{{ erreur() }}</div>
        }

        <div class="field">
          <label for="nomZone">Nom du quartier ou secteur</label>
          <input
            id="nomZone"
            name="nom"
            type="text"
            required
            maxlength="100"
            [(ngModel)]="nom"
            placeholder="Ex. Badalabougou, ACI 2000, Kalaban Coura…"
          />
        </div>

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
export class ZoneDialogComponent implements OnInit {
  private readonly service = inject(ZoneService);

  @Input() zone: Zone | null = null;
  @Output() readonly fermer = new EventEmitter<void>();
  @Output() readonly enregistre = new EventEmitter<Zone>();

  protected nom = '';
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.nom = this.zone?.nom ?? '';
  }

  protected enregistrer(): void {
    const nom = this.nom.trim();
    if (!nom) {
      this.erreur.set('Le nom de la zone est obligatoire.');
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);
    const requete = this.zone
      ? this.service.modifier(this.zone.id, nom)
      : this.service.creer(nom);
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

