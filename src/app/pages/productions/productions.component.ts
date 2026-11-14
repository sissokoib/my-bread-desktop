import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductionDialogComponent } from '../../dialogs/production-dialog.component';
import { Production } from '../../models/operations.model';
import { Produit } from '../../models/produit.model';
import { ApprovisionnementFarine, BilanFarine, FarineService } from '../../services/farine.service';
import { messageErreur } from '../../services/message-erreur';
import { ProductionService } from '../../services/production.service';
import { ProduitService } from '../../services/produit.service';

@Component({
  selector: 'app-productions',
  imports: [FormsModule, DecimalPipe, ProductionDialogComponent],
  templateUrl: './productions.component.html',
  styleUrl: './productions.component.css',
})
export class ProductionsComponent implements OnInit {
  private readonly productionService = inject(ProductionService);
  private readonly produitService = inject(ProduitService);
  private readonly farineService = inject(FarineService);

  protected readonly productions = signal<Production[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly bilanFarine = signal<BilanFarine | null>(null);
  protected readonly approvisionnements = signal<ApprovisionnementFarine[]>([]);
  protected readonly dateFiltre = signal(new Date().toISOString().slice(0, 10));
  protected readonly dialogOuvert = signal(false);
  protected readonly dialogFarineOuvert = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly enCoursFarine = signal(false);

  protected nombreSacsFarine = 50;
  protected fournisseurFarine = 'Grands Moulins';
  protected prixUnitaireFarine = 22500;

  protected get montantTotalFarine(): number {
    return (this.nombreSacsFarine || 0) * (this.prixUnitaireFarine || 0);
  }

  protected readonly produitsActifs = computed(() =>
    this.produits().filter((p) => p.actif),
  );
  protected readonly totalQuantite = computed(() =>
    this.productions().reduce((acc, p) => acc + p.totalQuantite, 0),
  );
  protected readonly totalValeurVente = computed(() =>
    this.productions().reduce((acc, p) => acc + p.valeurVenteTotale, 0),
  );
  protected readonly totalCoutRevient = computed(() =>
    this.productions().reduce((acc, p) => acc + p.coutRevientTotal, 0),
  );

  ngOnInit(): void {
    forkJoin({
      productions: this.productionService.lister(this.dateFiltre() || undefined),
      produits: this.produitService.lister(),
      bilanFarine: this.farineService.obtenirBilan(),
      approvisionnements: this.farineService.listerApprovisionnements(),
    }).subscribe({
      next: ({ productions, produits, bilanFarine, approvisionnements }) => {
        this.productions.set(productions);
        this.produits.set(produits);
        this.bilanFarine.set(bilanFarine);
        this.approvisionnements.set(approvisionnements);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected changerDate(date: string): void {
    this.dateFiltre.set(date);
    this.chargerProductions();
  }

  protected apresCreation(): void {
    this.dialogOuvert.set(false);
    this.chargerProductions();
  }

  protected enregistrerFarine(): void {
    if (!this.nombreSacsFarine || this.nombreSacsFarine <= 0) return;
    this.enCoursFarine.set(true);
    this.farineService
      .ajouterApprovisionnement({
        nombreSacs: this.nombreSacsFarine,
        fournisseur: this.fournisseurFarine.trim() || 'Fournisseur Farine',
        prixTotal: this.montantTotalFarine,
      })
      .subscribe({
        next: () => {
          this.enCoursFarine.set(false);
          this.dialogFarineOuvert.set(false);
          this.chargerProductions();
        },
        error: (err) => {
          this.enCoursFarine.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }

  protected supprimer(p: Production): void {
    this.productionService.supprimer(p.id).subscribe({
      next: () => this.chargerProductions(),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  private chargerProductions(): void {
    forkJoin({
      productions: this.productionService.lister(this.dateFiltre() || undefined),
      bilanFarine: this.farineService.obtenirBilan(),
      approvisionnements: this.farineService.listerApprovisionnements(),
    }).subscribe({
      next: ({ productions, bilanFarine, approvisionnements }) => {
        this.productions.set(productions);
        this.bilanFarine.set(bilanFarine);
        this.approvisionnements.set(approvisionnements);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}


