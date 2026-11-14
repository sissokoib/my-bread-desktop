import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BilanProduitTournee,
  MotifRetour,
  RetourPainItem,
  RetourPainRequest,
  Tournee,
} from '../../models/operations.model';
import { Produit } from '../../models/produit.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { AuthService } from '../../services/auth.service';
import { messageErreur } from '../../services/message-erreur';
import { ProduitService } from '../../services/produit.service';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

type TypeFiltrePeriode = 'JOURNALIER' | 'SEMAINE' | 'MENSUEL' | 'ANNUEL';

const STORAGE_INVENDUS_FOURNIL = 'mybread_invendus_fournil_v1';

export interface InvenduFournil {
  id: string;
  date: string;
  produitId: number;
  produitNom: string;
  quantite: number;
  valeurEstimee: number;
  motif: 'FIN_DE_JOURNEE' | 'SURPLUS_PRODUCTION' | 'DEFECTUEUX' | 'AUTRE';
  remarques?: string;
  dateCreation: string;
}

interface LigneDecompteLivreur {
  tourneeId: number;
  dateTournee: string;
  livreurId: number;
  livreurNom: string;
  livreurTelephone: string;
  quantiteChargee: number;
  quantiteRetournee: number;
  quantiteVendue: number;
  montantTotalVentes: number;
  montantTotalEncaisse: number;
  reliquatRestant: number;
  statut: 'SOLDE' | 'PARTIEL' | 'IMPAYE';
  bilansProduits: BilanProduitTournee[];
  retours: RetourPainItem[];
}

interface SaisieRetourModal {
  produitId: number;
  produitNom: string;
  prixVente: number;
  quantiteChargee: number;
  quantiteRetournee: number;
  motif: MotifRetour;
}

@Component({
  selector: 'app-bulletins',
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './bulletins.component.html',
  styleUrl: './bulletins.component.css',
})
export class BulletinsComponent implements OnInit {
  private readonly tourneeService = inject(TourneeService);
  private readonly utilisateurService = inject(UtilisateurService);
  private readonly produitService = inject(ProduitService);
  private readonly auth = inject(AuthService);

  @ViewChild('bulletinFiche') bulletinFicheRef?: ElementRef<HTMLDivElement>;

  // Données serveur & locales
  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly produits = signal<Produit[]>([]);
  protected readonly invendusFournil = signal<InvenduFournil[]>([]);

  // États UI
  protected readonly erreur = signal<string | null>(null);
  protected readonly notificationSucces = signal<string | null>(null);
  protected readonly enCoursExport = signal(false);
  protected readonly enCoursExportPdf = signal(false);
  protected readonly enCoursAction = signal(false);
  protected readonly erreurModal = signal<string | null>(null);

  // Modals
  protected readonly modalRetourOuvert = signal(false);
  protected readonly modalInvenduFournilOuvert = signal(false);

  // Filtres
  protected readonly typePeriode = signal<TypeFiltrePeriode>('JOURNALIER');
  protected dateJournaliere = new Date().toISOString().substring(0, 10);
  protected semaineChoisie = this.obtenirSemaineCourante();
  protected moisChoisi = new Date().toISOString().substring(0, 7);
  protected anneeChoisie = new Date().getFullYear();
  protected readonly livreurFiltreId = signal<number | null>(null);

  // Formulaire Retour Livreur
  protected retourForm = {
    livreurId: null as number | null,
    tourneeId: null as number | null,
    remarques: '',
  };
  protected saisiesRetourModal = signal<SaisieRetourModal[]>([]);

  // Formulaire Invendu Fournil
  protected formInvendu = {
    date: new Date().toISOString().substring(0, 10),
    produitId: null as number | null,
    quantite: 1,
    motif: 'FIN_DE_JOURNEE' as const,
    remarques: '',
  };

  // Nom de la boulangerie connectée
  protected readonly boulangerieNom = computed(() => {
    return this.auth.utilisateur()?.boulangerieNom || 'Boulangerie Artisanale My Bread';
  });

  // Liste des livreurs
  protected readonly livreurs = computed(() => {
    return this.utilisateurs().filter((u) => u.role === 'LIVREUR');
  });

  // Livreur sélectionné (objet)
  protected readonly livreurSelectionneObj = computed(() => {
    const id = this.livreurFiltreId();
    if (!id) return null;
    return this.livreurs().find((l) => l.id === id) || null;
  });

  // Tournées du livreur choisi pour le modal retour
  protected readonly tourneesDuLivreurModal = computed(() => {
    const livId = this.retourForm.livreurId;
    if (!livId) return [];
    return this.tournees().filter((t) => t.livreurId === livId);
  });

  // Lignes de décompte filtrées
  protected readonly lignesFiltrees = computed<LigneDecompteLivreur[]>(() => {
    const type = this.typePeriode();
    const livId = this.livreurFiltreId();
    const dateJ = this.dateJournaliere;
    const moisC = this.moisChoisi;
    const anneeC = this.anneeChoisie;
    const semC = this.semaineChoisie;

    return this.tournees()
      .filter((t) => {
        if (livId !== null && t.livreurId !== livId) {
          return false;
        }

        const dateT = t.dateTournee || '';
        switch (type) {
          case 'JOURNALIER':
            return dateT.startsWith(dateJ);
          case 'SEMAINE':
            return this.estDansLaSemaine(dateT, semC);
          case 'MENSUEL':
            return dateT.startsWith(moisC);
          case 'ANNUEL':
            return dateT.startsWith(String(anneeC));
        }
      })
      .map((t) => {
        // Pains chargés
        const quantiteChargee = (t.bilansProduits || []).reduce(
          (acc, b) => acc + (b.quantiteChargee || 0),
          0,
        );

        // Pains retournés par ce livreur
        const quantiteRetournee = (t.retours || []).reduce(
          (acc, r) => acc + (r.quantite || 0),
          0,
        );

        // Pains vendus facturés = Chargés - Retours
        const quantiteVendue = Math.max(0, quantiteChargee - quantiteRetournee);

        // Montant total ventes
        let montantVentes = t.totalVentes || 0;
        if (montantVentes === 0 && quantiteVendue > 0) {
          montantVentes = (t.bilansProduits || []).reduce((acc, bp) => {
            const prod = this.produits().find((p) => p.id === bp.produitId);
            const prix = prod ? prod.prixVente : 250;
            const netVendu = Math.max(0, bp.quantiteChargee - bp.quantiteRetournee);
            return acc + netVendu * prix;
          }, 0);
        }

        const montantVerse = t.totalEncaisse || 0;
        const reliquat = Math.max(0, montantVentes - montantVerse);

        let statut: 'SOLDE' | 'PARTIEL' | 'IMPAYE' = 'SOLDE';
        if (reliquat > 0) {
          statut = montantVerse > 0 ? 'PARTIEL' : 'IMPAYE';
        }

        return {
          tourneeId: t.id,
          dateTournee: t.dateTournee,
          livreurId: t.livreurId,
          livreurNom: t.livreurNom,
          livreurTelephone: t.livreurTelephone,
          quantiteChargee,
          quantiteRetournee,
          quantiteVendue,
          montantTotalVentes: montantVentes,
          montantTotalEncaisse: montantVerse,
          reliquatRestant: reliquat,
          statut,
          bilansProduits: t.bilansProduits || [],
          retours: t.retours || [],
        };
      });
  });

  // Invendus fournil filtrés selon la période
  protected readonly invendusFournilFiltres = computed(() => {
    const type = this.typePeriode();
    const dateJ = this.dateJournaliere;
    const moisC = this.moisChoisi;
    const anneeC = this.anneeChoisie;
    const semC = this.semaineChoisie;

    return this.invendusFournil().filter((inv) => {
      const d = inv.date;
      switch (type) {
        case 'JOURNALIER':
          return d.startsWith(dateJ);
        case 'SEMAINE':
          return this.estDansLaSemaine(d, semC);
        case 'MENSUEL':
          return d.startsWith(moisC);
        case 'ANNUEL':
          return d.startsWith(String(anneeC));
      }
    });
  });

  // Totaux des indicateurs
  protected readonly totalPainsCharges = computed(() => {
    return this.lignesFiltrees().reduce((acc, l) => acc + l.quantiteChargee, 0);
  });

  protected readonly totalPainsRetournesLivreurs = computed(() => {
    return this.lignesFiltrees().reduce((acc, l) => acc + l.quantiteRetournee, 0);
  });

  protected readonly totalPainsInvendusFournil = computed(() => {
    return this.invendusFournilFiltres().reduce((acc, i) => acc + i.quantite, 0);
  });

  protected readonly totalGlobalInvendus = computed(() => {
    return this.totalPainsRetournesLivreurs() + this.totalPainsInvendusFournil();
  });

  protected readonly totalPainsVendus = computed(() => {
    return this.lignesFiltrees().reduce((acc, l) => acc + l.quantiteVendue, 0);
  });

  protected readonly montantNetVentes = computed(() => {
    return this.lignesFiltrees().reduce((acc, l) => acc + l.montantTotalVentes, 0);
  });

  protected readonly montantTotalVerse = computed(() => {
    return this.lignesFiltrees().reduce((acc, l) => acc + l.montantTotalEncaisse, 0);
  });

  protected readonly reliquatGlobal = computed(() => {
    return Math.max(0, this.montantNetVentes() - this.montantTotalVerse());
  });

  protected readonly referenceBulletin = computed(() => {
    const dateClean = this.dateJournaliere.replace(/-/g, '');
    const suffixe = this.livreurFiltreId() ? `LIV-${this.livreurFiltreId()}` : 'EQUIPE';
    return `BUL-${dateClean}-${suffixe}`;
  });

  protected readonly dateEdition = computed(() => {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  protected readonly libellePeriodeActive = computed(() => {
    switch (this.typePeriode()) {
      case 'JOURNALIER':
        return `Journée du ${this.dateJournaliere}`;
      case 'SEMAINE':
        return `Semaine ${this.semaineChoisie}`;
      case 'MENSUEL':
        return `Mois ${this.moisChoisi}`;
      case 'ANNUEL':
        return `Année ${this.anneeChoisie}`;
    }
  });

  protected readonly libelleLivreurSelectionne = computed(() => {
    const liv = this.livreurSelectionneObj();
    return liv ? `${liv.nom} (${liv.telephone})` : 'Tous les livreurs de l\'équipe';
  });

  ngOnInit(): void {
    this.chargerInvendusFournilLocaux();
    this.chargerDonnees();
  }

  protected changerTypePeriode(type: TypeFiltrePeriode): void {
    this.typePeriode.set(type);
  }

  protected imprimerBulletin(): void {
    window.print();
  }

  protected calculerVendu(charge: number, retour: number): number {
    return Math.max(0, (charge || 0) - (retour || 0));
  }

  // ==============================================================
  // ACTIONS MODAL RETOUR LIVREUR
  // ==============================================================
  protected ouvrirModalRetour(): void {
    this.erreurModal.set(null);
    const livId = this.livreurFiltreId() || (this.livreurs()[0] ? this.livreurs()[0].id : null);
    this.retourForm.livreurId = livId;
    this.retourForm.tourneeId = null;
    this.retourForm.remarques = '';
    this.saisiesRetourModal.set([]);

    if (livId) {
      this.auChangementLivreurRetour(livId);
    }
    this.modalRetourOuvert.set(true);
  }

  protected auChangementLivreurRetour(livId: number | null): void {
    this.retourForm.livreurId = livId;
    const tournees = this.tournees().filter((t) => t.livreurId === livId);
    if (tournees.length > 0) {
      const tChoisie = tournees[0];
      this.retourForm.tourneeId = tChoisie.id;
      this.auChangementTourneeRetour(tChoisie.id);
    } else {
      this.retourForm.tourneeId = null;
      this.saisiesRetourModal.set([]);
    }
  }

  protected auChangementTourneeRetour(tourneeId: number | null): void {
    if (!tourneeId) {
      this.saisiesRetourModal.set([]);
      return;
    }
    const t = this.tournees().find((x) => x.id === tourneeId);
    if (!t) return;

    const saisies: SaisieRetourModal[] = (t.bilansProduits || []).map((bp) => {
      const prod = this.produits().find((p) => p.id === bp.produitId);
      const retoursExistants = (t.retours || [])
        .filter((r) => r.produitId === bp.produitId)
        .reduce((sum, r) => sum + r.quantite, 0);

      return {
        produitId: bp.produitId,
        produitNom: bp.produitNom,
        prixVente: prod ? prod.prixVente : 250,
        quantiteChargee: bp.quantiteChargee || 0,
        quantiteRetournee: retoursExistants || bp.quantiteRetournee || 0,
        motif: 'INVENDU',
      };
    });

    this.saisiesRetourModal.set(saisies);
  }

  protected validerRetourLivreur(): void {
    const tId = this.retourForm.tourneeId;
    if (!tId) return;

    const retours: RetourPainRequest[] = this.saisiesRetourModal()
      .filter((s) => s.quantiteRetournee > 0)
      .map((s) => ({
        produitId: s.produitId,
        quantite: Math.round(s.quantiteRetournee),
        motif: s.motif,
      }));

    this.enCoursAction.set(true);
    this.erreurModal.set(null);

    this.tourneeService
      .cloturer(tId, {
        retours,
        remarques: this.retourForm.remarques.trim() || 'Retours enregistrés et déduits',
      })
      .subscribe({
        next: (tourneeMaj) => {
          this.enCoursAction.set(false);
          this.modalRetourOuvert.set(false);
          const totalRetours = retours.reduce((sum, r) => sum + r.quantite, 0);
          this.notificationSucces.set(
            `Retour de ${totalRetours} pain(s) enregistré pour ${tourneeMaj.livreurNom}. Déduit du bulletin avec succès.`,
          );
          this.chargerDonnees();
        },
        error: (err) => {
          this.enCoursAction.set(false);
          this.erreurModal.set(messageErreur(err));
        },
      });
  }

  // ==============================================================
  // ACTIONS MODAL INVENDUS DU FOURNIL (BOUTIQUE)
  // ==============================================================
  protected ouvrirModalInvenduFournil(): void {
    this.formInvendu = {
      date: this.dateJournaliere || new Date().toISOString().substring(0, 10),
      produitId: this.produits()[0] ? this.produits()[0].id : null,
      quantite: 1,
      motif: 'FIN_DE_JOURNEE',
      remarques: '',
    };
    this.modalInvenduFournilOuvert.set(true);
  }

  protected validerInvenduFournil(): void {
    const prodId = this.formInvendu.produitId;
    if (!prodId || this.formInvendu.quantite <= 0) return;

    const prod = this.produits().find((p) => p.id === prodId);
    const nom = prod ? prod.nom : 'Pain';
    const prix = prod ? prod.prixVente : 250;

    const nouvelInvendu: InvenduFournil = {
      id: 'inv_' + Date.now(),
      date: this.formInvendu.date,
      produitId: prodId,
      produitNom: nom,
      quantite: Math.round(this.formInvendu.quantite),
      valeurEstimee: Math.round(this.formInvendu.quantite * prix),
      motif: this.formInvendu.motif,
      remarques: this.formInvendu.remarques.trim() || undefined,
      dateCreation: new Date().toISOString(),
    };

    const liste = [nouvelInvendu, ...this.invendusFournil()];
    this.invendusFournil.set(liste);
    this.sauvegarderInvendusFournilLocaux(liste);

    this.modalInvenduFournilOuvert.set(false);
    this.notificationSucces.set(
      `Invendu de ${nouvelInvendu.quantite} × « ${nom} » enregistré au fournil.`,
    );
  }

  private chargerInvendusFournilLocaux(): void {
    try {
      const brute = localStorage.getItem(STORAGE_INVENDUS_FOURNIL);
      if (brute) {
        this.invendusFournil.set(JSON.parse(brute));
      }
    } catch (e) {
      console.warn('Impossible de charger les invendus du fournil', e);
    }
  }

  private sauvegarderInvendusFournilLocaux(liste: InvenduFournil[]): void {
    try {
      localStorage.setItem(STORAGE_INVENDUS_FOURNIL, JSON.stringify(liste));
    } catch (e) {
      console.warn('Erreur sauvegarde invendus fournil', e);
    }
  }

  // ==============================================================
  // EXPORT BULLETIN EN IMAGE PNG ET PDF VIA CANVAS HAUTE RÉSOLUTION
  // SANS SIGNATURES, ÉPURÉE ET PROPRIÉTAIRE
  // ==============================================================
  private genererCanvasBulletin(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexte Canvas 2D non disponible'));
          return;
        }

        const width = 1200;
        const lignes = this.lignesFiltrees();
        const height = Math.max(880, 560 + lignes.length * 42);

        canvas.width = width;
        canvas.height = height;

        // 1. Fond blanc
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // 2. Charger l'image du pain pour le filigrane et le logo
        const breadImg = new Image();
        breadImg.crossOrigin = 'anonymous';
        breadImg.src = 'images/pain-3d.png';

        const drawContent = () => {
          // COURBURES GÉOMÉTRIQUES HAUT-DROITE (Teintes adoucies)
          ctx.save();
          ctx.fillStyle = '#DEAB38';
          ctx.fillRect(0, 0, width, 8);

          ctx.beginPath();
          ctx.moveTo(width - 280, 0);
          ctx.bezierCurveTo(width - 160, 30, width - 120, 100, width, 100);
          ctx.lineTo(width, 0);
          ctx.closePath();
          ctx.fillStyle = '#3D271D';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(width - 220, 0);
          ctx.bezierCurveTo(width - 140, 25, width - 100, 75, width, 75);
          ctx.lineTo(width, 0);
          ctx.closePath();
          ctx.fillStyle = '#C99426';
          ctx.fill();

          // COURBURES GÉOMÉTRIQUES BAS-GAUCHE (Teintes adoucies)
          ctx.fillStyle = '#DEAB38';
          ctx.fillRect(0, height - 8, width, 8);

          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, height - 100);
          ctx.bezierCurveTo(80, height - 100, 120, height - 30, 280, height);
          ctx.closePath();
          ctx.fillStyle = '#3D271D';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, height - 75);
          ctx.bezierCurveTo(60, height - 75, 90, height - 25, 220, height);
          ctx.closePath();
          ctx.fillStyle = '#C99426';
          ctx.fill();
          ctx.restore();

          // FILIGRANE CENTRAL : PHOTO DU PAIN + NOM (OPACITÉ REHAUSSÉE BIEN VISIBLE)
          ctx.save();
          ctx.globalAlpha = 0.18;
          const wmWidth = 440;
          const wmHeight = 265;
          const wmX = (width - wmWidth) / 2;
          const wmY = height / 2 - 110;
          if (breadImg.complete && breadImg.naturalWidth > 0) {
            ctx.drawImage(breadImg, wmX, wmY, wmWidth, wmHeight);
          }

          ctx.font = 'bold 44px sans-serif';
          ctx.fillStyle = 'rgba(90, 62, 43, 0.16)';
          ctx.textAlign = 'center';
          ctx.fillText(this.boulangerieNom().toUpperCase(), width / 2, wmY + wmHeight + 35);
          ctx.restore();

          // LOGO PAIN EN HAUT À GAUCHE
          if (breadImg.complete && breadImg.naturalWidth > 0) {
            ctx.save();
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#DEAB38';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(50, 36, 56, 56, 12);
            ctx.fill();
            ctx.stroke();
            ctx.drawImage(breadImg, 54, 40, 48, 48);
            ctx.restore();
          }

          // EN-TÊTE MARQUE
          ctx.fillStyle = '#3D271D';
          ctx.font = 'bold 26px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(this.boulangerieNom(), 120, 62);

          ctx.fillStyle = '#C99426';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('FOURNIL & DISTRIBUTION ARTISANALE', 120, 84);

          // TITRE DU BULLETIN EN HAUT À DROITE
          ctx.fillStyle = '#3D271D';
          ctx.font = '900 34px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('BULLETIN', width - 80, 72);

          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#6B7280';
          ctx.fillText(`Bulletin N° : ${this.referenceBulletin()}`, width - 80, 98);
          ctx.fillText(`Date : ${this.dateEdition()}`, width - 80, 118);
          ctx.textAlign = 'left';

          // 5. Encart Destinataire / Livreur
          let y = 145;
          ctx.fillStyle = '#FAFAFA';
          ctx.fillRect(50, y, width - 100, 60);
          ctx.strokeStyle = '#E5E7EB';
          ctx.strokeRect(50, y, width - 100, 60);

          ctx.fillStyle = '#B45309';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('DESTINATAIRE / LIVREUR :', 65, y + 22);

          ctx.fillStyle = '#3D271D';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(this.libelleLivreurSelectionne(), 65, y + 44);

          const statutText = this.reliquatGlobal() === 0 ? '✔️ DÉCOMPTE SOLDÉ (0 FCFA)' : '⚠️ RESTE À RÉGLER';
          ctx.fillStyle = this.reliquatGlobal() === 0 ? '#059669' : '#DC2626';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(statutText, width - 70, y + 36);
          ctx.textAlign = 'left';

          // 6. Tableau quadrillé style Designer (sans les numéros 1. 2. 3.)
          y = 225;
          ctx.fillStyle = '#3D271D';
          ctx.fillRect(50, y, width - 100, 38);
          ctx.strokeStyle = '#3D271D';
          ctx.strokeRect(50, y, width - 100, 38);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('N°', 65, y + 24);
          ctx.fillText('Date de livraison', 120, y + 24);
          ctx.fillText('Pains Sortis', 410, y + 24);
          ctx.fillText('Retours Déduits', 540, y + 24);
          ctx.fillText('Pains Facturés', 680, y + 24);
          ctx.fillText('Montant Total', 810, y + 24);
          ctx.fillText('Montant Versé', 940, y + 24);
          ctx.fillText('Solde Dû', 1060, y + 24);

          y += 38;
          ctx.font = '12px sans-serif';
          if (lignes.length === 0) {
            ctx.fillStyle = '#9CA3AF';
            ctx.fillText('Aucune livraison enregistrée pour cette sélection.', 65, y + 30);
            y += 50;
          } else {
            lignes.forEach((l, i) => {
              ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#FAF9F7';
              ctx.fillRect(50, y, width - 100, 36);
              ctx.strokeStyle = '#E5E7EB';
              ctx.strokeRect(50, y, width - 100, 36);

              ctx.fillStyle = '#6B7280';
              ctx.fillText((i + 1) < 10 ? `0${i + 1}` : `${i + 1}`, 65, y + 23);

              ctx.fillStyle = '#1F2937';
              ctx.fillText(`${l.dateTournee} (${l.livreurNom})`, 120, y + 23);
              ctx.fillText(`${l.quantiteChargee}`, 410, y + 23);

              ctx.fillStyle = '#B45309';
              ctx.fillText(l.quantiteRetournee > 0 ? `-${l.quantiteRetournee}` : '0', 540, y + 23);

              ctx.fillStyle = '#059669';
              ctx.font = 'bold 12px sans-serif';
              ctx.fillText(`${l.quantiteVendue}`, 680, y + 23);
              ctx.font = '12px sans-serif';

              ctx.fillStyle = '#1F2937';
              ctx.fillText(`${l.montantTotalVentes.toLocaleString()} F`, 810, y + 23);

              ctx.fillStyle = '#059669';
              ctx.fillText(`${l.montantTotalEncaisse.toLocaleString()} F`, 940, y + 23);

              ctx.fillStyle = l.reliquatRestant > 0 ? '#DC2626' : '#059669';
              ctx.fillText(`${l.reliquatRestant.toLocaleString()} F`, 1060, y + 23);

              y += 36;
            });

            // Ligne Total général
            ctx.fillStyle = '#F5ECE3';
            ctx.fillRect(50, y, width - 100, 38);
            ctx.strokeStyle = '#3D271D';
            ctx.strokeRect(50, y, width - 100, 38);

            ctx.fillStyle = '#3D271D';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('TOTAL GÉNÉRAL', 65, y + 24);
            ctx.fillText(`${this.totalPainsCharges()}`, 410, y + 24);

            ctx.fillStyle = '#B45309';
            ctx.fillText(`-${this.totalPainsRetournesLivreurs()}`, 540, y + 24);

            ctx.fillStyle = '#059669';
            ctx.fillText(`${this.totalPainsVendus()}`, 680, y + 24);

            ctx.fillStyle = '#111827';
            ctx.fillText(`${this.montantNetVentes().toLocaleString()} F`, 810, y + 24);

            ctx.fillStyle = '#059669';
            ctx.fillText(`${this.montantTotalVerse().toLocaleString()} F`, 940, y + 24);

            ctx.fillStyle = this.reliquatGlobal() > 0 ? '#DC2626' : '#059669';
            ctx.fillText(`${this.reliquatGlobal().toLocaleString()} F`, 1060, y + 24);

            y += 38;
          }

          // 7. Bas de bulletin : Règlement à gauche & Cadre sombre à droite
          y += 25;
          const summaryW = 380;
          const summaryX = width - 50 - summaryW;

          // Bloc modes de règlement & traçabilité à gauche
          const payBoxW = 680;
          ctx.fillStyle = '#FAFAF9';
          ctx.fillRect(50, y, payBoxW, 115);
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 1;
          ctx.strokeRect(50, y, payBoxW, 115);

          ctx.fillStyle = '#3D271D';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('MODES DE RÈGLEMENT & TRAÇABILITÉ :', 70, y + 25);

          // Puces de paiement (Espèces, Wave, Orange Money, Moov Money)
          // Espèces
          ctx.fillStyle = '#ECFDF5';
          ctx.fillRect(70, y + 36, 85, 26);
          ctx.strokeStyle = '#A7F3D0';
          ctx.strokeRect(70, y + 36, 85, 26);
          ctx.fillStyle = '#065F46';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Espèces', 88, y + 53);

          // Wave
          ctx.fillStyle = '#E0F2FE';
          ctx.fillRect(165, y + 36, 80, 26);
          ctx.strokeStyle = '#BAE6FD';
          ctx.strokeRect(165, y + 36, 80, 26);
          ctx.fillStyle = '#0284C7';
          ctx.fillText('Wave', 185, y + 53);

          // Orange Money
          ctx.fillStyle = '#FFF7ED';
          ctx.fillRect(255, y + 36, 120, 26);
          ctx.strokeStyle = '#FED7AA';
          ctx.strokeRect(255, y + 36, 120, 26);
          ctx.fillStyle = '#C2410C';
          ctx.fillText('Orange Money', 268, y + 53);

          // Moov Money
          ctx.fillStyle = '#EFF6FF';
          ctx.fillRect(385, y + 36, 105, 26);
          ctx.strokeStyle = '#BFDBFE';
          ctx.strokeRect(385, y + 36, 105, 26);
          ctx.fillStyle = '#1D4ED8';
          ctx.fillText('Moov Money', 398, y + 53);

          // Note explicative
          ctx.fillStyle = '#6B7280';
          ctx.font = '11px sans-serif';
          ctx.fillText('Les invendus rapportés au fournil ont été intégralement déduits.', 70, y + 80);
          ctx.fillText('Le montant net reflète fidèlement les pains réellement vendus et encaissés.', 70, y + 98);

          // Bloc synthèse
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(summaryX, y, summaryW, 115);
          ctx.strokeStyle = '#3D271D';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(summaryX, y, summaryW, 115);

          ctx.fillStyle = '#4B5563';
          ctx.font = '13px sans-serif';
          ctx.fillText('Sous-total Ventes Réelles :', summaryX + 20, y + 30);
          ctx.textAlign = 'right';
          ctx.fillText(`${this.montantNetVentes().toLocaleString()} FCFA`, summaryX + summaryW - 20, y + 30);
          ctx.textAlign = 'left';

          ctx.fillText('Total Encaissé en Caisse :', summaryX + 20, y + 55);
          ctx.fillStyle = '#059669';
          ctx.textAlign = 'right';
          ctx.fillText(`${this.montantTotalVerse().toLocaleString()} FCFA`, summaryX + summaryW - 20, y + 55);
          ctx.textAlign = 'left';

          // Bloc TOTAL NET À PAYER
          ctx.fillStyle = '#3D271D';
          ctx.fillRect(summaryX, y + 70, summaryW, 45);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText('NET À PAYER (SOLDE) :', summaryX + 20, y + 98);

          ctx.fillStyle = this.reliquatGlobal() > 0 ? '#DEAB38' : '#34D399';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${this.reliquatGlobal().toLocaleString()} FCFA`, summaryX + summaryW - 20, y + 98);
          ctx.textAlign = 'left';

          // 8. Coordonnées de contact
          ctx.fillStyle = '#4B5563';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('📞 +223 60 79 75 75   |   📍 Badalabougou, Bamako   |   ✉️ contact@mybread.ml', width - 50, height - 30);
          ctx.textAlign = 'left';

          // 9. Pied de page
          y += 145;
          ctx.fillStyle = '#9CA3AF';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Bulletin de décompte certifié conforme • ${this.boulangerieNom()} • ${this.dateEdition()}`, width / 2, y);

          resolve(canvas);
        };

        if (breadImg.complete && breadImg.naturalWidth > 0) {
          drawContent();
        } else {
          breadImg.onload = () => drawContent();
          breadImg.onerror = () => drawContent();
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // EXPORT FORMAT IMAGE PNG
  protected telechargerImage(): void {
    this.enCoursExport.set(true);
    this.genererCanvasBulletin()
      .then((canvas) => {
        const imageUri = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = imageUri;
        a.download = `bulletin-decompte-${this.referenceBulletin().toLowerCase()}.png`;
        a.click();
      })
      .catch((e) => console.error('Erreur génération image bulletin', e))
      .finally(() => this.enCoursExport.set(false));
  }

  // EXPORT FORMAT PDF TÉLÉCHARGEABLE DIRECTEMENT
  protected telechargerPDF(): void {
    this.enCoursExportPdf.set(true);
    this.genererCanvasBulletin()
      .then((canvas) => {
        const blob = this.convertirCanvasEnPdf(canvas);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulletin-decompte-${this.referenceBulletin().toLowerCase()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => console.error('Erreur génération PDF bulletin', e))
      .finally(() => this.enCoursExportPdf.set(false));
  }

  // Convertisseur natif Canvas vers PDF A4 officiel
  private convertirCanvasEnPdf(canvas: HTMLCanvasElement): Blob {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const jpegBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      jpegBytes[i] = binaryStr.charCodeAt(i);
    }

    const imgW = canvas.width;
    const imgH = canvas.height;
    // Format A4 portrait en points PostScript: 595.28 x 841.89
    const margin = 20;
    const maxPdfW = 595.28 - margin * 2;
    const maxPdfH = 841.89 - margin * 2;
    const ratio = Math.min(maxPdfW / imgW, maxPdfH / imgH);
    const renderW = +(imgW * ratio).toFixed(2);
    const renderH = +(imgH * ratio).toFixed(2);
    const offsetX = +((595.28 - renderW) / 2).toFixed(2);
    const offsetY = +((841.89 - renderH) / 2).toFixed(2);

    const encoder = new TextEncoder();
    const obj1 = encoder.encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    const obj2 = encoder.encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    const obj3 = encoder.encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
    );

    const streamContent = encoder.encode(`q\n${renderW} 0 0 ${renderH} ${offsetX} ${offsetY} cm\n/Im1 Do\nQ\n`);
    const obj4Header = encoder.encode(`4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n`);
    const obj4Footer = encoder.encode('endstream\nendobj\n');

    const obj5Header = encoder.encode(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    );
    const obj5Footer = encoder.encode('\nendstream\nendobj\n');

    const header = encoder.encode('%PDF-1.4\n');

    const offsets: number[] = [];
    let currentOffset = header.length;

    offsets.push(currentOffset);
    currentOffset += obj1.length;

    offsets.push(currentOffset);
    currentOffset += obj2.length;

    offsets.push(currentOffset);
    currentOffset += obj3.length;

    offsets.push(currentOffset);
    currentOffset += obj4Header.length + streamContent.length + obj4Footer.length;

    offsets.push(currentOffset);
    currentOffset += obj5Header.length + jpegBytes.length + obj5Footer.length;

    let xrefStr = 'xref\n0 6\n0000000000 65535 f \n';
    for (const o of offsets) {
      xrefStr += String(o).padStart(10, '0') + ' 00000 n \n';
    }
    const xref = encoder.encode(xrefStr);
    const trailer = encoder.encode(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`);

    return new Blob(
      [
        header,
        obj1,
        obj2,
        obj3,
        obj4Header,
        streamContent,
        obj4Footer,
        obj5Header,
        jpegBytes,
        obj5Footer,
        xref,
        trailer,
      ],
      { type: 'application/pdf' },
    );
  }

  private obtenirSemaineCourante(): string {
    const d = new Date();
    const dNum = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dNum.getUTCDay() || 7;
    dNum.setUTCDate(dNum.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dNum.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((dNum.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${dNum.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private estDansLaSemaine(dateStr: string, weekStr: string): boolean {
    if (!dateStr || !weekStr) return false;
    return dateStr.startsWith(weekStr.substring(0, 4));
  }

  private chargerDonnees(): void {
    forkJoin({
      tournees: this.tourneeService.lister().pipe(catchError(() => of([]))),
      utilisateurs: this.utilisateurService.lister().pipe(catchError(() => of([]))),
      produits: this.produitService.lister().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ tournees, utilisateurs, produits }) => {
        this.tournees.set(tournees);
        this.utilisateurs.set(utilisateurs);
        this.produits.set(produits);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
