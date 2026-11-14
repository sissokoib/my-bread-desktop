import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProduitDialogComponent } from '../../dialogs/produit-dialog.component';
import { Produit } from '../../models/produit.model';
import { messageErreur } from '../../services/message-erreur';
import { ProduitService } from '../../services/produit.service';

@Component({
  selector: 'app-produits',
  imports: [FormsModule, DecimalPipe, ProduitDialogComponent],
  templateUrl: './produits.component.html',
  styleUrl: './produits.component.css',
})
export class ProduitsComponent implements OnInit {
  private readonly service = inject(ProduitService);

  protected readonly produits = signal<Produit[]>([]);
  protected readonly recherche = signal('');
  protected readonly actifsSeulement = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogOuvert = signal(false);
  protected readonly produitSelectionne = signal<Produit | null>(null);

  protected readonly produitsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const actifs = this.actifsSeulement();
    return this.produits().filter(
      (p) => (!actifs || p.actif) && (!q || p.nom.toLowerCase().includes(q)),
    );
  });

  ngOnInit(): void {
    this.charger();
  }

  protected ouvrirCreation(): void {
    this.produitSelectionne.set(null);
    this.dialogOuvert.set(true);
  }

  protected ouvrirEdition(produit: Produit): void {
    this.produitSelectionne.set(produit);
    this.dialogOuvert.set(true);
  }

  protected apresEnregistrement(): void {
    this.dialogOuvert.set(false);
    this.charger();
  }

  private charger(): void {
    this.service.lister().subscribe({
      next: (liste) => {
        this.produits.set(liste);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}

