import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DepenseDialogComponent } from '../../dialogs/depense-dialog.component';
import {
  Depense,
  ModePaiement,
  Paiement,
  ReglementDetteLivreur,
  Tournee,
} from '../../models/operations.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { DashboardService } from '../../services/dashboard.service';
import { DepenseService } from '../../services/depense.service';
import { messageErreur } from '../../services/message-erreur';
import { PaiementService } from '../../services/paiement.service';
import { SoundService } from '../../services/sound.service';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

const STORAGE_REGLEMENTS_KEY = 'mybread_reglements_dettes_v1';
const STORAGE_DETTES_KEY = 'mybread_dettes_manuelles_v1';
const STORAGE_FOND_CAISSE_KEY = 'mybread_fond_caisse_v1';

export interface CoupuresCaisse {
  b10000: number;
  b5000: number;
  b2000: number;
  b1000: number;
  b500: number;
  p500: number;
  p250: number;
  p200: number;
  p100: number;
  p50: number;
  p25: number;
}

export interface MouvementCaisse {
  id: string;
  type: 'ENTREE' | 'SORTIE';
  dateHeure: string;
  categorie: string;
  libelle: string;
  intervenant?: string;
  modePaiement: string;
  montant: number;
}

@Component({
  selector: 'app-caisse',
  imports: [CommonModule, FormsModule, DecimalPipe, DepenseDialogComponent],
  templateUrl: './caisse.component.html',
  styleUrl: './caisse.component.css',
})
export class CaisseComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly depenseService = inject(DepenseService);
  private readonly tourneeService = inject(TourneeService);
  private readonly paiementService = inject(PaiementService);
  private readonly utilisateurService = inject(UtilisateurService);
  private readonly soundService = inject(SoundService);

  // État général
  protected dateSelectionnee = signal(new Date().toISOString().slice(0, 10));
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly notification = signal<string | null>(null);

  // Données brutes
  protected readonly depenses = signal<Depense[]>([]);
  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly paiementsClients = signal<Paiement[]>([]);
  protected readonly reglementsLivreurs = signal<ReglementDetteLivreur[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);

  // Modals
  protected readonly modalDepenseOuvert = signal(false);
  protected readonly modalEncaissementOuvert = signal(false);
  protected readonly modalClotureOuvert = signal(false);

  // Filtre du journal
  protected readonly filtreType = signal<'TOUT' | 'ENTREE' | 'SORTIE'>('TOUT');
  protected readonly rechercheJournal = signal('');

  // Fond de caisse initial du matin pour la date sélectionnée (0 FCFA par défaut)
  protected fondDeCaisseMatin = signal<number>(0);
  protected readonly caisseCloturee = signal<boolean>(false);

  // Formulaire d'encaissement direct (versement livreur / vente comptoir / liquidation invendus)
  protected formEncaissement = {
    type: 'VERSEMENT_LIVREUR' as 'VERSEMENT_LIVREUR' | 'VENTE_COMPTOIR' | 'LIQUIDATION_INVENDUS' | 'AUTRE',
    livreurId: null as number | null,
    montant: null as number | null,
    modePaiement: 'ESPECES' as ModePaiement,
    libelle: '',
  };

  // Pointage & Comptage physique pour la clôture (Signal réactif pour mise à jour instantanée)
  protected readonly coupures = signal<CoupuresCaisse>({
    b10000: 0,
    b5000: 0,
    b2000: 0,
    b1000: 0,
    b500: 0,
    p500: 0,
    p250: 0,
    p200: 0,
    p100: 0,
    p50: 0,
    p25: 0,
  });

  protected majCoupure(cle: keyof CoupuresCaisse, val: any): void {
    const qte = Math.max(0, parseInt(val, 10) || 0);
    this.coupures.update((c) => ({ ...c, [cle]: qte }));
  }

  // Liste des livreurs actifs
  protected readonly livreurs = computed(() => {
    return this.utilisateurs().filter((u) => u.role === 'LIVREUR' || (u.poste && u.poste.toLowerCase().includes('livreur')));
  });

  // Total entrées du jour (Source unique de vérité pour éviter tout doublon)
  protected readonly totalEntreesJour = computed(() => {
    // 1. Somme de tous les paiements réels du jour (tournées, boutique comptoir, règlements clients)
    const encaissePaiements = this.paiementsClients().reduce((s, p) => s + (p.montant || 0), 0);

    // 2. Tournées orphelines éventuelles (sécurité pour d'anciennes tournées sans ligne de paiement associée)
    const idsTourneesAvecPaiement = new Set(this.paiementsClients().map((p) => p.tourneeId).filter(Boolean));
    const encaisseTourneesOrphelines = this.tournees()
      .filter((t) => !idsTourneesAvecPaiement.has(t.id))
      .reduce((s, t) => s + (t.totalEncaisse || 0), 0);

    // 3. Règlements manuels saisis dans l'onglet Dettes uniquement (commençant par REG-)
    const encaisseReglementsManuel = this.reglementsLivreurs()
      .filter((r) => r.dateReglement === this.dateSelectionnee() && r.id?.startsWith('REG-'))
      .reduce((s, r) => s + (r.montant || 0), 0);

    return encaissePaiements + encaisseTourneesOrphelines + encaisseReglementsManuel;
  });

  // Total sorties (dépenses et salaires) du jour
  protected readonly totalSortiesJour = computed(() => {
    return this.depenses().reduce((s, d) => s + (d.montant || 0), 0);
  });

  // Solde net journalier = Fond matin + Entrées - Sorties
  protected readonly soldeTheoriqueCaisse = computed(() => {
    return this.fondDeCaisseMatin() + this.totalEntreesJour() - this.totalSortiesJour();
  });

  // Total espèces physiques comptées (calculé dynamiquement à partir du signal coupures)
  protected readonly totalEspecesComptees = computed(() => {
    const c = this.coupures();
    return (
      (c.b10000 || 0) * 10000 +
      (c.b5000 || 0) * 5000 +
      (c.b2000 || 0) * 2000 +
      (c.b1000 || 0) * 1000 +
      (c.b500 || 0) * 500 +
      (c.p500 || 0) * 500 +
      (c.p250 || 0) * 250 +
      (c.p200 || 0) * 200 +
      (c.p100 || 0) * 100 +
      (c.p50 || 0) * 50 +
      (c.p25 || 0) * 25
    );
  });

  // Écart de caisse (Physique - Théorique)
  protected readonly ecartCaisse = computed(() => {
    return this.totalEspecesComptees() - this.soldeTheoriqueCaisse();
  });

  // Mouvements combinés du journal chronologique (Source unique de vérité des encaissements)
  protected readonly journalMouvements = computed<MouvementCaisse[]>(() => {
    const liste: MouvementCaisse[] = [];
    const dateCible = this.dateSelectionnee();

    // Mémoriser les identifiants de tournées déjà couvertes par un paiement pour éviter tout doublon
    const idsTourneesAvecPaiement = new Set<number>();

    // 1. Entrées issues des paiements (source de vérité unique des encaissements)
    for (const p of this.paiementsClients()) {
      if (p.tourneeId) {
        idsTourneesAvecPaiement.add(p.tourneeId);
      }
      const t = p.tourneeId ? this.tournees().find((item) => item.id === p.tourneeId) : null;
      const remLower = (p.remarques || '').toLowerCase();
      const estLiquidation = remLower.includes('liquidation') || remLower.includes('rassis') || remLower.includes('invendu');
      const estTournee = !estLiquidation && (!!p.tourneeId || remLower.includes('tournée'));
      const estVersementLivreur = !estLiquidation && (estTournee || remLower.includes('livreur'));

      let intervenant = t?.livreurNom;
      if (!intervenant) {
        if (estVersementLivreur) {
          intervenant = 'Livreur';
        } else {
          intervenant = p.clientNomBoutique || 'Comptoir Fournil';
        }
      }

      let categorie = 'Paiement Client';
      if (estLiquidation) {
        categorie = 'Liquidation Invendus / Rassis';
      } else if (estTournee) {
        categorie = 'Retour Tournée Pain';
      } else if (estVersementLivreur) {
        categorie = 'Versement Livreur';
      }

      let libelle = p.remarques;
      if (!libelle) {
        if (estTournee) {
          libelle = `Versement tournée n°${p.tourneeId} - ${intervenant}`;
        } else if (estVersementLivreur) {
          libelle = `Versement direct - ${intervenant}`;
        } else {
          libelle = `Règlement vente boutique - ${intervenant}`;
        }
      }

      // Nettoyage de la date/heure pour affichage agréable (ex: "2026-11-18 13:17")
      let dateHeurePropre = p.datePaiement || dateCible;
      if (dateHeurePropre.includes('T')) {
        dateHeurePropre = dateHeurePropre.replace('T', ' ').slice(0, 16);
      }

      liste.push({
        id: `paiement-${p.id}`,
        type: 'ENTREE',
        dateHeure: dateHeurePropre,
        categorie,
        libelle,
        intervenant,
        modePaiement: p.modePaiement || 'ESPECES',
        montant: p.montant,
      });
    }

    // 2. Tournées orphelines éventuelles (sécurité si aucune ligne paiement n'est rattachée)
    for (const t of this.tournees()) {
      if ((t.totalEncaisse || 0) > 0 && !idsTourneesAvecPaiement.has(t.id)) {
        liste.push({
          id: `tournee-${t.id}`,
          type: 'ENTREE',
          dateHeure: t.heureRetour ? `${dateCible} ${t.heureRetour.slice(11, 16)}` : dateCible,
          categorie: 'Retour Tournée Pain',
          libelle: `Versement retour tournée n°${t.id} - ${t.livreurNom || 'Livreur'} (${t.nombreLivraisons} livraisons)`,
          intervenant: t.livreurNom || 'Livreur',
          modePaiement: 'ESPECES',
          montant: t.totalEncaisse,
        });
      }
    }

    // 3. Règlements de dettes saisis manuellement (uniquement depuis l'onglet dettes, id commençant par REG-)
    for (const r of this.reglementsLivreurs()) {
      if (r.dateReglement === dateCible && r.id?.startsWith('REG-')) {
        liste.push({
          id: `reglement-${r.id}`,
          type: 'ENTREE',
          dateHeure: r.dateReglement,
          categorie: 'Remboursement Dette Livreur',
          libelle: `Versement dette : ${r.livreurNom} (Reste dû : ${r.detteApres.toLocaleString()} F)`,
          intervenant: r.livreurNom,
          modePaiement: r.modePaiement || 'ESPECES',
          montant: r.montant,
        });
      }
    }

    // 4. Sorties issues des dépenses et salaires
    for (const d of this.depenses()) {
      const estRation = /\[RATION#\d+\]/.test(d.libelle || '');
      const estAvance = /\[AVANCE#\d+\]/.test(d.libelle || '');
      let catLib = 'Charge d\'exploitation';
      if (estRation) catLib = 'Ration journalière repas';
      else if (estAvance) catLib = 'Avance sur salaire';
      else if (d.categorie === 'SALAIRE') catLib = 'Salaire / Prime employé';
      else if (d.categorie === 'FARINE') catLib = 'Achat de farine';
      else if (d.categorie === 'BOIS_GAZ') catLib = 'Énergie / Bois / Gaz';
      else if (d.categorie === 'TRANSPORT') catLib = 'Carburant / Transport';

      let dateHeureDepense = d.dateDepense || dateCible;
      if (dateHeureDepense.includes('T')) {
        dateHeureDepense = dateHeureDepense.replace('T', ' ').slice(0, 16);
      }

      const libellePropre = (d.libelle || '')
        .replace(/\s*\[RATION#\d+\]/g, '')
        .replace(/\s*\[AVANCE#\d+\]/g, '')
        .trim();

      liste.push({
        id: `depense-${d.id}`,
        type: 'SORTIE',
        dateHeure: dateHeureDepense,
        categorie: catLib,
        libelle: libellePropre,
        intervenant: 'Boulangerie',
        modePaiement: 'ESPECES',
        montant: d.montant,
      });
    }

    // Tri par date / heure décroissante (les mouvements les plus récents en premier)
    return liste.sort((a, b) => b.dateHeure.localeCompare(a.dateHeure) || b.id.localeCompare(a.id));
  });

  // Journal filtré
  protected readonly journalFiltre = computed(() => {
    const fType = this.filtreType();
    const q = this.rechercheJournal().trim().toLowerCase();

    return this.journalMouvements().filter((m) => {
      if (fType !== 'TOUT' && m.type !== fType) return false;
      if (q) {
        const txt = `${m.categorie} ${m.libelle} ${m.intervenant || ''} ${m.montant}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  });

  // Pagination du journal (10 lignes par page)
  protected readonly taillePage = 10;
  protected readonly pageCourante = signal<number>(1);

  protected readonly totalPages = computed(() => {
    const total = this.journalFiltre().length;
    return Math.max(1, Math.ceil(total / this.taillePage));
  });

  protected readonly journalPagine = computed(() => {
    const totalP = this.totalPages();
    const pageValide = Math.min(Math.max(1, this.pageCourante()), totalP);
    const debut = (pageValide - 1) * this.taillePage;
    return this.journalFiltre().slice(debut, debut + this.taillePage);
  });

  protected readonly indexDebutPagine = computed(() => {
    if (this.journalFiltre().length === 0) return 0;
    const pageValide = Math.min(Math.max(1, this.pageCourante()), this.totalPages());
    return (pageValide - 1) * this.taillePage + 1;
  });

  protected readonly indexFinPagine = computed(() => {
    const pageValide = Math.min(Math.max(1, this.pageCourante()), this.totalPages());
    const fin = pageValide * this.taillePage;
    return Math.min(fin, this.journalFiltre().length);
  });

  protected pageSuivante(): void {
    if (this.pageCourante() < this.totalPages()) {
      this.pageCourante.update((p) => p + 1);
    }
  }

  protected pagePrecedente(): void {
    if (this.pageCourante() > 1) {
      this.pageCourante.update((p) => p - 1);
    }
  }

  ngOnInit(): void {
    this.nettoyerAncienFondGlobal();
    this.chargerFondCaissePourDate(this.dateSelectionnee());
    this.chargerReglementsLocaux();
    this.chargerDonnees();
  }

  private nettoyerAncienFondGlobal(): void {
    try {
      // Supprimer l'ancienne clé globale qui imposait 20000 F sur toutes les dates
      localStorage.removeItem(STORAGE_FOND_CAISSE_KEY);
    } catch {}
  }

  private chargerFondCaissePourDate(date: string): void {
    try {
      const saved = localStorage.getItem(`${STORAGE_FOND_CAISSE_KEY}_${date}`);
      if (saved !== null && saved !== undefined && saved.trim() !== '') {
        this.fondDeCaisseMatin.set(Number(saved) || 0);
      } else {
        // Par défaut : 0 FCFA si non spécifié pour cette date
        this.fondDeCaisseMatin.set(0);
      }
      const cloture = localStorage.getItem(`mybread_cloture_caisse_v1_${date}`);
      this.caisseCloturee.set(cloture === 'true');
    } catch {
      this.fondDeCaisseMatin.set(0);
      this.caisseCloturee.set(false);
    }
  }

  protected validerEtCloturerJournee(): void {
    const date = this.dateSelectionnee();
    this.caisseCloturee.set(true);
    try {
      localStorage.setItem(`mybread_cloture_caisse_v1_${date}`, 'true');
    } catch {}
    this.modalClotureOuvert.set(false);
    this.afficherNotification(
      `🔒 Journée du ${date} clôturée et verrouillée. Solde constaté : ${this.totalEspecesComptees().toLocaleString()} FCFA.`,
    );
  }

  protected deverrouillerJournee(): void {
    const date = this.dateSelectionnee();
    if (!confirm(`Déverrouiller la caisse de la journée du ${date} pour effectuer une correction ?`)) return;
    this.caisseCloturee.set(false);
    try {
      localStorage.removeItem(`mybread_cloture_caisse_v1_${date}`);
    } catch {}
    this.afficherNotification(`🔓 Journée du ${date} déverrouillée.`);
  }

  protected envoyerRapportWhatsAppPDG(): void {
    const date = this.dateSelectionnee();
    const fond = this.fondDeCaisseMatin().toLocaleString('fr-FR');
    const entrees = this.totalEntreesJour().toLocaleString('fr-FR');
    const sorties = this.totalSortiesJour().toLocaleString('fr-FR');
    const solde = this.soldeTheoriqueCaisse().toLocaleString('fr-FR');
    const physique = this.totalEspecesComptees().toLocaleString('fr-FR');
    const ecart = this.ecartCaisse().toLocaleString('fr-FR');
    const nbTournees = this.tournees().length;
    const nbDepenses = this.depenses().length;
    const statut = this.caisseCloturee() ? 'CLÔTURÉE ✅' : 'EN COURS ⏳';

    const texte = [
      `🥖 *RAPPORT DE CAISSE MY BREAD*`,
      `📅 Journée du : *${date}* (${statut})`,
      `────────────────────`,
      `💼 Fond de caisse matin : *${fond} FCFA*`,
      `🟢 Total Entrées (${nbTournees} tournée(s)) : *+${entrees} FCFA*`,
      `🔴 Total Sorties (${nbDepenses} dépense(s)) : *-${sorties} FCFA*`,
      `────────────────────`,
      `💰 *SOLDE NET EN CAISSE : ${solde} FCFA*`,
      this.totalEspecesComptees() > 0 ? `💵 Espèces comptées : *${physique} FCFA* (Écart : ${ecart} F)` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(texte)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected ouvrirDialogueAjusterFond(): void {
    const date = this.dateSelectionnee();
    const actuel = this.fondDeCaisseMatin();
    const saisie = prompt(
      `Saisissez le fond de caisse (monnaie de départ / espèces en tiroir) pour la journée du ${date} en FCFA :`,
      actuel.toString()
    );

    if (saisie !== null) {
      const montant = parseInt(saisie.trim(), 10);
      if (!isNaN(montant) && montant >= 0) {
        this.sauvegarderFondCaisse(montant);
      } else {
        alert('Veuillez saisir un montant positif ou zéro.');
      }
    }
  }

  protected sauvegarderFondCaisse(val: number): void {
    const date = this.dateSelectionnee();
    this.fondDeCaisseMatin.set(val);
    try {
      localStorage.setItem(`${STORAGE_FOND_CAISSE_KEY}_${date}`, val.toString());
      this.afficherNotification(`Fond de caisse du ${date} ajusté à ${val.toLocaleString()} FCFA.`);
    } catch {}
  }

  private chargerReglementsLocaux(): void {
    try {
      const raw = localStorage.getItem(STORAGE_REGLEMENTS_KEY);
      if (raw) {
        const tous: ReglementDetteLivreur[] = JSON.parse(raw);
        // Filtrer pour éliminer d'éventuels anciens doublons de tests ou caisse-reg-
        const nettoyes = tous.filter((r) => r.id && !r.id.startsWith('caisse-reg-'));
        this.reglementsLivreurs.set(nettoyes);
        if (nettoyes.length !== tous.length) {
          localStorage.setItem(STORAGE_REGLEMENTS_KEY, JSON.stringify(nettoyes));
        }
      }
    } catch {}
  }

  protected changerDate(deltaJours: number): void {
    const d = new Date(this.dateSelectionnee());
    d.setDate(d.getDate() + deltaJours);
    this.dateSelectionnee.set(d.toISOString().slice(0, 10));
    this.pageCourante.set(1);
    this.chargerDonnees();
  }

  protected reinitialiserAujourdhui(): void {
    this.dateSelectionnee.set(new Date().toISOString().slice(0, 10));
    this.pageCourante.set(1);
    this.chargerDonnees();
  }

  protected chargerDonnees(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    const date = this.dateSelectionnee();
    this.chargerFondCaissePourDate(date);

    forkJoin({
      depenses: this.depenseService.lister(date),
      tournees: this.tourneeService.lister(date),
      paiements: this.paiementService.lister({ date }),
      utilisateurs: this.utilisateurService.lister(),
    }).subscribe({
      next: (res) => {
        this.chargement.set(false);
        this.depenses.set(res.depenses || []);
        this.tournees.set(res.tournees || []);
        this.paiementsClients.set(res.paiements || []);
        this.utilisateurs.set(res.utilisateurs || []);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected surDepenseEnregistree(nouvelleDepense: Depense): void {
    this.modalDepenseOuvert.set(false);
    this.afficherNotification(`Dépense de ${nouvelleDepense.montant.toLocaleString()} FCFA enregistrée.`);
    this.chargerDonnees();
  }

  protected ouvrirModalEncaissement(): void {
    this.formEncaissement = {
      type: 'VERSEMENT_LIVREUR',
      livreurId: this.livreurs()[0]?.id || null,
      montant: null,
      modePaiement: 'ESPECES',
      libelle: '',
    };
    this.modalEncaissementOuvert.set(true);
  }

  protected enregistrerEncaissement(): void {
    const montant = this.formEncaissement.montant;
    if (!montant || montant <= 0) {
      alert('Veuillez saisir un montant positif.');
      return;
    }

    if (this.formEncaissement.type === 'VERSEMENT_LIVREUR') {
      const livreur = this.livreurs().find((l) => l.id === this.formEncaissement.livreurId);
      if (!livreur) {
        alert('Veuillez sélectionner un livreur.');
        return;
      }

      // Associer à la tournée du jour de ce livreur si disponible
      const tourneeLivreur = this.tournees().find((t) => t.livreurId === livreur.id);

      // ENREGISTRER DIRECTEMENT DANS LE BACKEND (Base de données TiDB Cloud)
      // Source unique de vérité partagée entre le Web, Desktop et Mobile
      this.paiementService
        .creer({
          tourneeId: tourneeLivreur?.id,
          montant: Math.round(montant),
          modePaiement: this.formEncaissement.modePaiement,
          remarques: this.formEncaissement.libelle?.trim() || `Versement livreur : ${livreur.nom}${tourneeLivreur ? ' (Tournée #' + tourneeLivreur.id + ')' : ''}`,
        })
        .subscribe({
          next: () => {
            this.modalEncaissementOuvert.set(false);
            this.soundService.jouerSonCaisse();
            this.afficherNotification(`Encaissement de ${montant.toLocaleString()} FCFA de ${livreur.nom} validé et synchronisé.`);
            this.chargerDonnees();
          },
          error: (err) => {
            alert('Erreur lors de l\'enregistrement : ' + messageErreur(err));
          },
        });
    } else {
      // Vente directe au comptoir / Liquidation invendus / Autre encaissement
      const libelleDefaut =
        this.formEncaissement.type === 'VENTE_COMPTOIR'
          ? 'Vente directe boutique comptoir'
          : this.formEncaissement.type === 'LIQUIDATION_INVENDUS'
            ? 'Liquidation invendus / pains rassis à prix réduit'
            : 'Autre apport en caisse';
      const prefixeLiquidation =
        this.formEncaissement.type === 'LIQUIDATION_INVENDUS' &&
        this.formEncaissement.libelle &&
        !this.formEncaissement.libelle.toLowerCase().includes('liquidation')
          ? `Liquidation invendus : ${this.formEncaissement.libelle.trim()}`
          : this.formEncaissement.libelle?.trim() || libelleDefaut;

      this.paiementService
        .creer({
          montant: Math.round(montant),
          modePaiement: this.formEncaissement.modePaiement,
          remarques: prefixeLiquidation,
        })
        .subscribe({
          next: () => {
            this.modalEncaissementOuvert.set(false);
            this.soundService.jouerSonCaisse();
            this.afficherNotification(`Vente comptoir de ${montant.toLocaleString()} FCFA enregistrée en caisse.`);
            this.chargerDonnees();
          },
          error: (err) => {
            alert('Erreur: ' + messageErreur(err));
          },
        });
    }
  }

  protected afficherNotification(msg: string): void {
    this.notification.set(msg);
    setTimeout(() => {
      this.notification.set(null);
    }, 4500);
  }

  protected imprimerJournal(): void {
    window.print();
  }
}
