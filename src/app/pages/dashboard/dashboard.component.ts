import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Client } from '../../models/client.model';
import {
  Commande,
  DashboardResume,
  Depense,
  Livraison,
  Production,
  Tournee,
} from '../../models/operations.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { ClientService } from '../../services/client.service';
import { CommandeService } from '../../services/commande.service';
import { DashboardService } from '../../services/dashboard.service';
import { DepenseService } from '../../services/depense.service';
import { LivraisonService } from '../../services/livraison.service';
import { messageErreur } from '../../services/message-erreur';
import { ProductionService } from '../../services/production.service';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

interface PointMensuel {
  cleMois: string;
  libelleMois: string;
  x: number;
  depenses: number;
  ventes: number;
  benefice: number;
  yDepense: number;
  yBenefice: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DecimalPipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly productionService = inject(ProductionService);
  private readonly commandeService = inject(CommandeService);
  private readonly tourneeService = inject(TourneeService);
  private readonly livraisonService = inject(LivraisonService);
  private readonly depenseService = inject(DepenseService);
  private readonly clientService = inject(ClientService);
  private readonly utilisateurService = inject(UtilisateurService);

  /** Date sélectionnée (par défaut : aujourd'hui pour être 100% raccord avec l'application mobile PDG) */
  protected readonly dateSelectionnee = signal<string>(new Date().toISOString().substring(0, 10));

  protected readonly resume = signal<DashboardResume | null>(null);
  protected readonly productions = signal<Production[]>([]);
  protected readonly commandes = signal<Commande[]>([]);
  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly livraisons = signal<Livraison[]>([]);
  protected readonly depenses = signal<Depense[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly erreur = signal<string | null>(null);

  protected readonly utilisateursActifsCount = computed(
    () => this.utilisateurs().filter((u) => u.actif).length,
  );

  // =========================================================================
  // INDICATEURS DE LA VUE D'ENSEMBLE (FILTRÉS PAR DATE OU CUMUL GLOBAL)
  // =========================================================================
  protected readonly quantiteProduiteAffichee = computed(() => {
    const d = this.dateSelectionnee();
    if (d && this.resume()) {
      return this.resume()!.quantiteProduiteJour;
    }
    const liste = d
      ? this.productions().filter((p) => p.dateProduction === d)
      : this.productions();
    return liste.reduce((acc, p) => acc + (p.totalQuantite || 0), 0);
  });

  protected readonly nombreCommandesAffiche = computed(() => {
    const d = this.dateSelectionnee();
    if (!d) {
      return this.commandes().length;
    }
    return this.commandes().filter((c) => c.dateLivraisonSouhaitee === d).length;
  });

  protected readonly quantiteLivreeAffichee = computed(() => {
    const d = this.dateSelectionnee();
    if (d && this.resume()) {
      return this.resume()!.quantiteLivreeJour;
    }
    const tourneesFiltrees = d
      ? this.tournees().filter((t) => t.dateTournee === d)
      : this.tournees();
    const totalDepuisTournees = tourneesFiltrees.reduce(
      (acc, t) =>
        acc +
        (t.bilansProduits ?? []).reduce((s, b) => s + (b.quantiteLivree || 0), 0),
      0,
    );
    const livsFiltrees = d
      ? this.livraisons().filter((l) => l.dateLivraison.startsWith(d))
      : this.livraisons();
    const totalDepuisLivs = livsFiltrees.reduce(
      (acc, l) =>
        acc + (l.lignes ?? []).reduce((s, lg) => s + (lg.quantite || 0), 0),
      0,
    );
    const base = totalDepuisTournees > 0 ? totalDepuisTournees : totalDepuisLivs;

    const cmdsLivrees = d
      ? this.commandes().filter((c) => c.dateLivraisonSouhaitee === d && c.statut === 'LIVREE')
      : this.commandes().filter((c) => c.statut === 'LIVREE');
    const totalCmds = cmdsLivrees.reduce(
      (acc, c) => acc + (c.lignes ?? []).reduce((s, lg) => s + (lg.quantite || 0), 0),
      0,
    );

    return base + totalCmds;
  });

  protected readonly quantiteRetourneeAffichee = computed(() => {
    const d = this.dateSelectionnee();
    if (d && this.resume()) {
      return this.resume()!.quantiteRetourneeJour;
    }
    const tourneesFiltrees = d
      ? this.tournees().filter((t) => t.dateTournee === d)
      : this.tournees();
    return tourneesFiltrees.reduce(
      (acc, t) =>
        acc + (t.retours ?? []).reduce((s, r) => s + (r.quantite || 0), 0),
      0,
    );
  });

  protected readonly quantiteRestanteAffichee = computed(() => {
    const prod = this.quantiteProduiteAffichee();
    const liv = this.quantiteLivreeAffichee();
    return Math.max(0, prod - liv);
  });

  protected readonly ventesAffichees = computed(() => {
    const d = this.dateSelectionnee();
    if (d && this.resume()) {
      return this.resume()!.ventesJour;
    }
    const livs = d
      ? this.livraisons().filter((l) => l.dateLivraison.startsWith(d))
      : this.livraisons();
    const totalLivs = livs.reduce((acc, l) => acc + (l.montantTotal || 0), 0);
    const trns = d
      ? this.tournees().filter((t) => t.dateTournee === d)
      : this.tournees();
    const totalTrns = trns.reduce((acc, t) => acc + (t.totalVentes || 0), 0);
    const baseVentes = totalLivs > 0 ? totalLivs : totalTrns;

    const cmdsLivrees = d
      ? this.commandes().filter((c) => c.dateLivraisonSouhaitee === d && c.statut === 'LIVREE')
      : this.commandes().filter((c) => c.statut === 'LIVREE');
    const totalCmds = cmdsLivrees.reduce((acc, c) => acc + (c.montantTotal || 0), 0);

    return baseVentes + totalCmds;
  });

  protected readonly depensesAffichees = computed(() => {
    const d = this.dateSelectionnee();
    if (d && this.resume()) {
      return this.resume()!.depensesJour + this.resume()!.coutProductionJour;
    }
    const deps = d
      ? this.depenses().filter((x) => x.dateDepense === d)
      : this.depenses();
    const prods = d
      ? this.productions().filter((p) => p.dateProduction === d)
      : this.productions();
    return (
      deps.reduce((acc, x) => acc + (x.montant || 0), 0) +
      prods.reduce((acc, p) => acc + (p.coutRevientTotal || 0), 0)
    );
  });

  // =========================================================================
  // CAMEMBERT DYNAMIQUE (RÉPARTITION DES STOCKS)
  // =========================================================================
  protected readonly partVenduePie = computed(() => {
    const prod = this.quantiteProduiteAffichee();
    const liv = this.quantiteLivreeAffichee();
    if (prod <= 0 && liv <= 0) {
      return 0;
    }
    if (prod <= 0) {
      return 100;
    }
    return Math.min(100, Math.max(0, Math.round((liv / prod) * 100)));
  });

  protected readonly partRestantePie = computed(() => {
    const prod = this.quantiteProduiteAffichee();
    const liv = this.quantiteLivreeAffichee();
    if (prod <= 0 && liv <= 0) {
      return 0;
    }
    return 100 - this.partVenduePie();
  });

  protected readonly strokeDashPie = computed(() => {
    const circonference = 2 * Math.PI * 24; // r = 24 => ~150.8
    const rempli = (this.partVenduePie() / 100) * circonference;
    return `${rempli} ${circonference}`;
  });

  // =========================================================================
  // GRAPHIQUE DYNAMIQUE SUR LES 6 DERNIERS MOIS (DÉPENSES VS BÉNÉFICES)
  // =========================================================================
  private readonly donnees6MoisBrutes = computed(() => {
    const nomsMois = [
      'Jan',
      'Fév',
      'Mar',
      'Avr',
      'Mai',
      'Juin',
      'Juil',
      'Août',
      'Sep',
      'Oct',
      'Nov',
      'Déc',
    ];
    const refDate = this.dateSelectionnee()
      ? new Date(this.dateSelectionnee() + 'T00:00:00')
      : new Date();

    const moisListe: { cle: string; libelle: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      moisListe.push({
        cle: `${y}-${m}`,
        libelle: nomsMois[dt.getMonth()],
      });
    }

    return moisListe.map((m, idx) => {
      const depMois = this.depenses()
        .filter((d) => d.dateDepense.startsWith(m.cle))
        .reduce((acc, d) => acc + (d.montant || 0), 0);
      const coutProdMois = this.productions()
        .filter((p) => p.dateProduction.startsWith(m.cle))
        .reduce((acc, p) => acc + (p.coutRevientTotal || 0), 0);
      const totalDepenses = depMois + coutProdMois;

      const ventesLivs = this.livraisons()
        .filter((l) => l.dateLivraison.startsWith(m.cle))
        .reduce((acc, l) => acc + (l.montantTotal || 0), 0);
      const ventesTournees = this.tournees()
        .filter((t) => t.dateTournee.startsWith(m.cle))
        .reduce((acc, t) => acc + (t.totalVentes || 0), 0);
      const totalVentes = Math.max(ventesLivs, ventesTournees);
      const benefice = Math.max(0, totalVentes - totalDepenses);

      return {
        cleMois: m.cle,
        libelleMois: m.libelle,
        x: 75 + idx * 84, // 6 points espacés de x=75 à x=495
        depenses: totalDepenses,
        ventes: totalVentes,
        benefice,
      };
    });
  });

  protected readonly maxOrdonnee = computed(() => {
    const maxReel = Math.max(
      ...this.donnees6MoisBrutes().map((d) => Math.max(d.depenses, d.benefice)),
      0,
    );
    if (maxReel <= 0) {
      return 40000;
    }
    const pas = Math.pow(10, Math.max(3, Math.floor(Math.log10(maxReel))));
    return Math.ceil(maxReel / pas) * pas;
  });

  protected readonly graduationsY = computed(() => {
    const max = this.maxOrdonnee();
    return [
      { y: 38, label: this.formaterCourt(max) },
      { y: 69, label: this.formaterCourt(Math.round(max * 0.75)) },
      { y: 100, label: this.formaterCourt(Math.round(max * 0.5)) },
      { y: 131, label: this.formaterCourt(Math.round(max * 0.25)) },
      { y: 162, label: '0' },
    ];
  });

  protected readonly pointsMensuels = computed<PointMensuel[]>(() => {
    const max = this.maxOrdonnee();
    const yBase = 162;
    const hauteurUtile = 124; // de y=162 (0) à y=38 (max)
    return this.donnees6MoisBrutes().map((d) => ({
      ...d,
      yDepense: Math.round(yBase - (Math.min(d.depenses, max) / max) * hauteurUtile),
      yBenefice: Math.round(yBase - (Math.min(d.benefice, max) / max) * hauteurUtile),
    }));
  });

  protected readonly cheminCourbeDepenses = computed(() =>
    this.construireCourbeLisse(this.pointsMensuels().map((p) => ({ x: p.x, y: p.yDepense }))),
  );

  protected readonly cheminAireDepenses = computed(() => {
    const pts = this.pointsMensuels();
    if (pts.length === 0) return '';
    const courbe = this.cheminCourbeDepenses();
    return `${courbe} L ${pts[pts.length - 1].x} 162 L ${pts[0].x} 162 Z`;
  });

  protected readonly cheminCourbeBenefices = computed(() =>
    this.construireCourbeLisse(this.pointsMensuels().map((p) => ({ x: p.x, y: p.yBenefice }))),
  );

  protected readonly cheminAireBenefices = computed(() => {
    const pts = this.pointsMensuels();
    if (pts.length === 0) return '';
    const courbe = this.cheminCourbeBenefices();
    return `${courbe} L ${pts[pts.length - 1].x} 162 L ${pts[0].x} 162 Z`;
  });

  protected readonly pointMaxDepense = computed<PointMensuel | null>(() => {
    const pts = this.pointsMensuels();
    const max = pts.reduce<PointMensuel | null>(
      (best, cur) => (best === null || cur.depenses > best.depenses ? cur : best),
      null,
    );
    return max && max.depenses > 0 ? max : null;
  });

  protected readonly pointMaxBenefice = computed<PointMensuel | null>(() => {
    const pts = this.pointsMensuels();
    const max = pts.reduce<PointMensuel | null>(
      (best, cur) => (best === null || cur.benefice > best.benefice ? cur : best),
      null,
    );
    return max && max.benefice > 0 ? max : null;
  });

  // =========================================================================
  // TOP 10 DES LIVREURS PAR VENTES (100% DYNAMIQUE DEPUIS LA BASE)
  // =========================================================================
  protected readonly topLivreurs = computed(() => {
    const ventesParNom = new Map<string, number>();

    // 1. Initialiser avec tous les livreurs créés par l'admin
    for (const u of this.utilisateurs()) {
      if (u.role === 'LIVREUR') {
        ventesParNom.set(u.nom, 0);
      }
    }

    // 2. Additionner les ventes depuis les tournées (filtrées par date si sélectionnée)
    const d = this.dateSelectionnee();
    const tourneesFiltrees = d
      ? this.tournees().filter((t) => t.dateTournee === d)
      : this.tournees();

    for (const t of tourneesFiltrees) {
      const nom = t.livreurNom || `Livreur #${t.livreurId}`;
      const montant = t.totalVentes > 0 ? t.totalVentes : t.totalEncaisse;
      ventesParNom.set(nom, (ventesParNom.get(nom) ?? 0) + montant);
    }

    // 2b. Additionner les ventes des commandes directes livrées
    const cmdsLivreesFiltrees = d
      ? this.commandes().filter((c) => c.dateLivraisonSouhaitee === d && c.statut === 'LIVREE')
      : this.commandes().filter((c) => c.statut === 'LIVREE');

    for (const c of cmdsLivreesFiltrees) {
      const nom = c.livreurNom || 'Livreur';
      ventesParNom.set(nom, (ventesParNom.get(nom) ?? 0) + (c.montantTotal || 0));
    }

    // 3. Si aucune tournée n'a encore de totalVentes mais des livraisons existent
    if (Array.from(ventesParNom.values()).every((v) => v === 0)) {
      const livsFiltrees = d
        ? this.livraisons().filter((l) => l.dateLivraison.startsWith(d))
        : this.livraisons();
      for (const l of livsFiltrees) {
        const nom = l.livreurNom || `Livreur #${l.livreurId}`;
        ventesParNom.set(nom, (ventesParNom.get(nom) ?? 0) + (l.montantTotal || 0));
      }
    }

    const entrees = Array.from(ventesParNom.entries())
      .map(([nom, val]) => ({ nom, val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 10);

    const maxVal = Math.max(...entrees.map((e) => e.val), 1);
    return entrees.map((e) => ({
      nom: e.nom,
      pourcentage: e.val > 0 ? Math.max(12, Math.round((e.val / maxVal) * 76)) : 6,
      etiquette: `${this.formaterCourt(e.val)} F`,
    }));
  });

  ngOnInit(): void {
    this.changerDate(this.dateSelectionnee());
    this.chargerToutesDonnees();
  }

  protected definirAujourdhui(): void {
    this.changerDate(new Date().toISOString().substring(0, 10));
  }

  protected definirCumulGlobal(): void {
    this.changerDate('');
  }

  protected changerDate(date: string): void {
    this.dateSelectionnee.set(date);
    if (date) {
      this.dashboardService.obtenirResume(date).subscribe({
        next: (res) => this.resume.set(res),
        error: () => this.resume.set(null),
      });
    } else {
      this.resume.set(null);
    }
  }

  protected formaterCourt(valeur: number): string {
    if (valeur >= 1_000_000) {
      return `${(valeur / 1_000_000).toFixed(1).replace('.0', '')}M`;
    }
    if (valeur >= 1_000) {
      return `${Math.round(valeur / 1_000)}k`;
    }
    return `${valeur}`;
  }

  private construireCourbeLisse(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx1 = Math.round(p0.x + (p1.x - p0.x) / 2);
      const cx2 = Math.round(p0.x + (p1.x - p0.x) / 2);
      d += ` C ${cx1} ${p0.y}, ${cx2} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }

  private chargerToutesDonnees(): void {
    this.productionService.lister().subscribe({
      next: (p) => this.productions.set(p),
      error: (err) => this.erreur.set(messageErreur(err)),
    });
    this.commandeService.lister().subscribe({
      next: (cmd) => this.commandes.set(cmd),
      error: () => {},
    });
    this.tourneeService.lister().subscribe({
      next: (t) => this.tournees.set(t),
      error: () => {},
    });
    this.livraisonService.lister().subscribe({
      next: (l) => this.livraisons.set(l),
      error: () => {},
    });
    this.depenseService.lister().subscribe({
      next: (d) => this.depenses.set(d),
      error: () => {},
    });
    this.clientService.lister().subscribe({
      next: (c) => this.clients.set(c),
      error: () => {},
    });
    this.utilisateurService.lister().subscribe({
      next: (u) => this.utilisateurs.set(u),
      error: () => {},
    });
  }
}
