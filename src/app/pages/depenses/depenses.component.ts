import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DepenseDialogComponent } from '../../dialogs/depense-dialog.component';
import { CategorieDepense, Depense } from '../../models/operations.model';
import { DepenseService } from '../../services/depense.service';
import { messageErreur } from '../../services/message-erreur';

@Component({
  selector: 'app-depenses',
  imports: [FormsModule, DecimalPipe, DepenseDialogComponent],
  templateUrl: './depenses.component.html',
  styleUrl: './depenses.component.css',
})
export class DepensesComponent implements OnInit {
  private readonly service = inject(DepenseService);

  protected readonly depenses = signal<Depense[]>([]);
  protected readonly dateFiltre = signal(new Date().toISOString().slice(0, 10));
  protected readonly dialogOuvert = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly totalMontant = computed(() =>
    this.depenses().reduce((acc, d) => acc + d.montant, 0),
  );

  ngOnInit(): void {
    this.charger();
  }

  protected changerDate(date: string): void {
    this.dateFiltre.set(date);
    this.charger();
  }

  protected apresCreation(): void {
    this.dialogOuvert.set(false);
    this.charger();
  }

  protected supprimer(d: Depense): void {
    this.service.supprimer(d.id).subscribe({
      next: () => this.charger(),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected libelleCategorie(cat: CategorieDepense): string {
    switch (cat) {
      case 'FARINE':
        return 'Farine';
      case 'LEVURE_INTRANTS':
        return 'Levure / intrants';
      case 'BOIS_GAZ':
        return 'Bois / gaz';
      case 'ELECTRICITE_EAU':
        return 'Électricité & eau';
      case 'SALAIRE':
        return 'Salaires';
      case 'TRANSPORT':
        return 'Transport';
      case 'ENTRETIEN':
        return 'Entretien';
      case 'AUTRE':
        return 'Autre';
    }
  }

  private charger(): void {
    this.service.lister(this.dateFiltre() || undefined).subscribe({
      next: (liste) => {
        this.depenses.set(liste);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}

