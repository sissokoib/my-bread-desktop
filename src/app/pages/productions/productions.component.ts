import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { ProductionDialogComponent } from '../../dialogs/production-dialog.component';
import { Production, StockDisponible } from '../../models/operations.model';
import { Produit } from '../../models/produit.model';
import { CommandeService } from '../../services/commande.service';
import { ApprovisionnementFarine, BilanFarine, FarineService } from '../../services/farine.service';
import { messageErreur } from '../../services/message-erreur';
import { ProductionService } from '../../services/production.service';
import { ProduitService } from '../../services/produit.service';

export interface IntrantFournil {
  id: string;
  nom: string;
  unite: string;
  quantite: number;
  seuilAlerte: number;
  icone: string;
}

export const STORAGE_INTRANTS_KEY = 'mybread_intrants_fournil_v1';

const INTRANTS_PAR_DEFAUT: IntrantFournil[] = [
  { id: 'levure', nom: 'Levure sèche boulangère', unite: 'paquets (500g)', quantite: 18, seuilAlerte: 6, icone: 'science' },
  { id: 'sel', nom: 'Sel fin de panification', unite: 'sacs (25kg)', quantite: 5, seuilAlerte: 2, icone: 'grain' },
  { id: 'ameliorant', nom: 'Améliorant de panification', unite: 'sachets (1kg)', quantite: 10, seuilAlerte: 4, icone: 'auto_awesome' },
  { id: 'huile', nom: 'Huile / Matière grasse', unite: 'bidons (20L)', quantite: 3, seuilAlerte: 1, icone: 'water_drop' },
  { id: 'energie', nom: 'Bois / Gaz du four', unite: 'charges / bouteilles', quantite: 8, seuilAlerte: 3, icone: 'local_fire_department' },
];

export function chargerIntrantsFournil(): IntrantFournil[] {
  try {
    const raw = localStorage.getItem(STORAGE_INTRANTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INTRANTS_PAR_DEFAUT;
}

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
  private readonly commandeService = inject(CommandeService);

  protected readonly productions = signal<Production[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly stocksJour = signal<StockDisponible[]>([]);
  protected readonly bilanFarine = signal<BilanFarine | null>(null);
  protected readonly approvisionnements = signal<ApprovisionnementFarine[]>([]);
  protected readonly intrants = signal<IntrantFournil[]>(chargerIntrantsFournil());
  protected readonly dateFiltre = signal(new Date().toISOString().slice(0, 10));
  protected readonly dialogOuvert = signal(false);
  protected readonly dialogFarineOuvert = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly enCoursFarine = signal(false);

  /** Seuil standard de rendement attendu par sac de 50kg (pains / sac). */
  protected readonly seuilRendementStandard = 280;

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
  protected readonly totalCommandesJour = computed(() =>
    this.stocksJour().reduce((acc, s) => acc + s.quantiteCommandee, 0),
  );
  protected readonly resteAProduire = computed(() =>
    Math.max(0, this.totalCommandesJour() - this.totalQuantite()),
  );
  protected readonly sacsFarineRecommandes = computed(() =>
    Math.ceil(this.resteAProduire() / 270),
  );
  protected readonly totalValeurVente = computed(() =>
    this.productions().reduce((acc, p) => acc + p.valeurVenteTotale, 0),
  );
  protected readonly totalCoutRevient = computed(() =>
    this.productions().reduce((acc, p) => acc + p.coutRevientTotal, 0),
  );

  protected readonly nbIntrantsEnAlerte = computed(() =>
    this.intrants().filter((i) => i.quantite <= i.seuilAlerte).length,
  );

  protected rendementFournee(p: Production): number {
    if (p.rendementObtenu && p.rendementObtenu > 0) return p.rendementObtenu;
    if (p.sacsFarineUtilises && p.sacsFarineUtilises > 0) {
      return Math.round(p.totalQuantite / p.sacsFarineUtilises);
    }
    return 0;
  }

  protected ajusterIntrant(id: string, delta: number): void {
    const maj = this.intrants().map((i) =>
      i.id === id ? { ...i, quantite: Math.max(0, i.quantite + delta) } : i,
    );
    this.intrants.set(maj);
    try {
      localStorage.setItem(STORAGE_INTRANTS_KEY, JSON.stringify(maj));
    } catch {}
  }

  protected filtrerDateRapide(cible: 'AUJOURDHUI' | 'HIER' | 'TOUT'): void {
    if (cible === 'TOUT') {
      this.changerDate('');
    } else if (cible === 'AUJOURDHUI') {
      this.changerDate(new Date().toISOString().slice(0, 10));
    } else {
      const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      this.changerDate(hier);
    }
  }

  ngOnInit(): void {
    forkJoin({
      productions: this.productionService.lister(this.dateFiltre() || undefined).pipe(catchError(() => of([]))),
      produits: this.produitService.lister().pipe(catchError(() => of([]))),
      stocksJour: this.commandeService.stockDisponible(this.dateFiltre() || undefined).pipe(catchError(() => of([]))),
      bilanFarine: this.farineService.obtenirBilan().pipe(catchError(() => of(null))),
      approvisionnements: this.farineService.listerApprovisionnements().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ productions, produits, stocksJour, bilanFarine, approvisionnements }) => {
        this.productions.set(productions);
        this.produits.set(produits);
        this.stocksJour.set(stocksJour);
        if (bilanFarine) this.bilanFarine.set(bilanFarine);
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
      productions: this.productionService.lister(this.dateFiltre() || undefined).pipe(catchError(() => of([]))),
      stocksJour: this.commandeService.stockDisponible(this.dateFiltre() || undefined).pipe(catchError(() => of([]))),
      bilanFarine: this.farineService.obtenirBilan().pipe(catchError(() => of(null))),
      approvisionnements: this.farineService.listerApprovisionnements().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ productions, stocksJour, bilanFarine, approvisionnements }) => {
        this.productions.set(productions);
        this.stocksJour.set(stocksJour);
        if (bilanFarine) this.bilanFarine.set(bilanFarine);
        this.approvisionnements.set(approvisionnements);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
