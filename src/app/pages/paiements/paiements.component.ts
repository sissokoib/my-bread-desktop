import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  DetteLivreur,
  ModePaiement,
  ReglementDetteLivreur,
  Tournee,
} from '../../models/operations.model';
import { Utilisateur } from '../../models/utilisateur.model';
import { messageErreur } from '../../services/message-erreur';
import { TourneeService } from '../../services/tournee.service';
import { UtilisateurService } from '../../services/utilisateur.service';

const STORAGE_DETTES_KEY = 'mybread_dettes_manuelles_v1';
const STORAGE_REGLEMENTS_KEY = 'mybread_reglements_dettes_v1';

interface DetteManuelle {
  id: string;
  livreurId: number;
  montant: number;
  motif: string;
  date: string;
}

@Component({
  selector: 'app-paiements',
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './paiements.component.html',
  styleUrl: './paiements.component.css',
})
export class PaiementsComponent implements OnInit {
  private readonly utilisateurService = inject(UtilisateurService);
  private readonly tourneeService = inject(TourneeService);

  // Signaux principaux
  protected readonly utilisateurs = signal<Utilisateur[]>([]);
  protected readonly tournees = signal<Tournee[]>([]);
  protected readonly dettesManuelles = signal<DetteManuelle[]>([]);
  protected readonly reglements = signal<ReglementDetteLivreur[]>([]);

  // Filtres
  protected readonly recherche = signal('');
  protected readonly filtreDebiteursSeulement = signal(true);
  protected readonly erreur = signal<string | null>(null);
  protected readonly notificationSucces = signal<string | null>(null);

  // Modals
  protected readonly modalReglementOuvert = signal(false);
  protected readonly modalAjoutDetteOuvert = signal(false);

  // Formulaires
  protected formReglement = {
    livreurId: null as number | null,
    montant: 0,
    modePaiement: 'ESPECES' as ModePaiement,
    date: new Date().toISOString().substring(0, 10),
    remarques: '',
  };

  protected formAjoutDette = {
    livreurId: null as number | null,
    montant: 0,
    date: new Date().toISOString().substring(0, 10),
    motif: '',
  };

  // Liste des utilisateurs ayant le rôle LIVREUR
  protected readonly livreurs = computed(() => {
    return this.utilisateurs().filter(
      (u) =>
        u.role === 'LIVREUR' &&
        (!u.poste || u.poste.toLowerCase().includes('livreur')) &&
        !u.nom.toLowerCase().includes('djelimakan')
    );
  });

  // Calcul dynamique de la situation de dette de chaque livreur
  protected readonly situationsLivreurs = computed<DetteLivreur[]>(() => {
    const listLivreurs = this.livreurs();
    const listTournees = this.tournees();
    const listDettes = this.dettesManuelles();
    const listReglements = this.reglements();

    return listLivreurs.map((l) => {
      // 1. Tournées du livreur
      const tourneesDuLivreur = listTournees.filter((t) => t.livreurId === l.id);
      const totalVentes = tourneesDuLivreur.reduce((acc, t) => acc + (t.totalVentes || 0), 0);
      const totalEncaisse = tourneesDuLivreur.reduce((acc, t) => acc + (t.totalEncaisse || 0), 0);

      // Écart non versé issu des tournées = Max(0, Ventes - Versé en tournée)
      const ecartTournees = tourneesDuLivreur.reduce((acc, t) => {
        const diff = (t.totalVentes || 0) - (t.totalEncaisse || 0);
        return acc + (diff > 0 ? diff : 0);
      }, 0);

      // 2. Dettes manuelles notées
      const dettesNotées = listDettes
        .filter((d) => d.livreurId === l.id)
        .reduce((acc, d) => acc + d.montant, 0);

      // Dette totale cumulée
      const detteCumulee = ecartTournees + dettesNotées;

      // 3. Total des versements réglés par ce livreur
      const reglementsLivreur = listReglements.filter((r) => r.livreurId === l.id);
      const totalRegle = reglementsLivreur.reduce((acc, r) => acc + r.montant, 0);

      // 4. Reste à devoir actuel = Dette cumulée - Total remboursé
      const reste = Math.max(0, detteCumulee - totalRegle);

      const dernierReglement =
        reglementsLivreur.length > 0
          ? reglementsLivreur[0].dateReglement
          : undefined;

      return {
        livreurId: l.id,
        livreurNom: l.nom,
        livreurTelephone: l.telephone,
        detteInitiale: dettesNotées,
        totalVentesTournees: totalVentes,
        totalEncaisseTournees: totalEncaisse,
        detteCumulee: detteCumulee,
        totalRegle: totalRegle,
        resteADevoir: reste,
        derniereDateReglement: dernierReglement,
        nombreTournees: tourneesDuLivreur.length,
      };
    });
  });

  // Filtrage selon la recherche et le filtre débiteurs
  protected readonly situationsFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const debiteursSeulement = this.filtreDebiteursSeulement();

    return this.situationsLivreurs().filter((s) => {
      if (debiteursSeulement && s.resteADevoir <= 0) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        s.livreurNom.toLowerCase().includes(q) ||
        s.livreurTelephone.includes(q)
      );
    });
  });

  // Liste des livreurs pour le dropdown de règlement
  protected readonly livreursDisponibles = computed(() => {
    return [...this.situationsLivreurs()].sort((a, b) => b.resteADevoir - a.resteADevoir);
  });

  // Livreur sélectionné dans le formulaire de versement
  protected readonly livreurSelectionneReglement = computed(() => {
    const id = this.formReglement.livreurId;
    if (!id) return null;
    return this.situationsLivreurs().find((s) => s.livreurId === id) || null;
  });

  // Statistiques agrégées
  protected readonly dettesTotalesRestantes = computed(() => {
    return this.situationsLivreurs().reduce((acc, s) => acc + s.resteADevoir, 0);
  });

  protected readonly nombreDebiteurs = computed(() => {
    return this.situationsLivreurs().filter((s) => s.resteADevoir > 0).length;
  });

  protected readonly totalRemboursementEncaisses = computed(() => {
    return this.reglements().reduce((acc, r) => acc + r.montant, 0);
  });

  protected readonly cumulDettesInitiales = computed(() => {
    return this.situationsLivreurs().reduce((acc, s) => acc + s.detteCumulee, 0);
  });

  protected readonly tauxRecouvrement = computed(() => {
    const totalDettes = this.cumulDettesInitiales();
    if (totalDettes === 0) return 100;
    const regle = this.totalRemboursementEncaisses();
    return Math.min(100, Math.round((regle / totalDettes) * 100));
  });

  ngOnInit(): void {
    this.chargerDonneesLocales();
    this.chargerDonneesServeur();
  }

  protected initiales(nom: string): string {
    if (!nom) return 'L';
    return nom
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected readonly optionsModesPaiement = [
    { valeur: 'ESPECES' as ModePaiement, nom: 'Espèces (Cash)', logo: 'images/paiements/especes.svg' },
    { valeur: 'WAVE' as ModePaiement, nom: 'Wave', logo: 'images/paiements/wave.png' },
    { valeur: 'ORANGE_MONEY' as ModePaiement, nom: 'Orange Money', logo: 'images/paiements/orange-money.png' },
    { valeur: 'MOOV_MONEY' as ModePaiement, nom: 'Moov Money', logo: 'images/paiements/moov-money.png' },
    { valeur: 'VIREMENT' as ModePaiement, nom: 'Virement bancaire', logo: 'images/paiements/virement.svg' },
  ];

  protected readonly dropdownPaiementOuvert = signal(false);

  protected toggleDropdownPaiement(event: Event): void {
    event.stopPropagation();
    this.dropdownPaiementOuvert.update((v) => !v);
  }

  protected choisirModePaiement(mode: ModePaiement): void {
    this.formReglement.modePaiement = mode;
    this.dropdownPaiementOuvert.set(false);
  }

  protected getLogoMode(mode: ModePaiement): string {
    switch (mode) {
      case 'ESPECES':
        return 'images/paiements/especes.svg';
      case 'WAVE':
        return 'images/paiements/wave.png';
      case 'ORANGE_MONEY':
        return 'images/paiements/orange-money.png';
      case 'MOOV_MONEY':
        return 'images/paiements/moov-money.png';
      case 'VIREMENT':
        return 'images/paiements/virement.svg';
    }
  }

  protected libelleMode(mode: ModePaiement): string {
    switch (mode) {
      case 'ESPECES':
        return 'Espèces (Cash)';
      case 'WAVE':
        return 'Wave';
      case 'ORANGE_MONEY':
        return 'Orange Money';
      case 'MOOV_MONEY':
        return 'Moov Money';
      case 'VIREMENT':
        return 'Virement bancaire';
    }
  }

  protected calculerNouveauReste(resteActuel: number, montantVerse: number): number {
    return Math.max(0, resteActuel - (montantVerse || 0));
  }

  protected auChangementLivreurReglement(livreurId: number | null): void {
    if (!livreurId) return;
    const liv = this.situationsLivreurs().find((s) => s.livreurId === livreurId);
    if (liv && liv.resteADevoir > 0) {
      // Pré-remplir le montant par le reste à devoir
      this.formReglement.montant = liv.resteADevoir;
    }
  }

  protected ouvrirModalReglement(liv: DetteLivreur | null): void {
    if (liv) {
      this.formReglement.livreurId = liv.livreurId;
      this.formReglement.montant = liv.resteADevoir > 0 ? liv.resteADevoir : 5000;
    } else {
      const premierDebiteur = this.situationsLivreurs().find((s) => s.resteADevoir > 0);
      this.formReglement.livreurId = premierDebiteur ? premierDebiteur.livreurId : (this.livreurs()[0]?.id || null);
      this.formReglement.montant = premierDebiteur ? premierDebiteur.resteADevoir : 5000;
    }
    this.formReglement.modePaiement = 'ESPECES';
    this.formReglement.date = new Date().toISOString().substring(0, 10);
    this.formReglement.remarques = '';
    this.modalReglementOuvert.set(true);
  }

  protected ouvrirModalAjoutDette(liv: DetteLivreur | null = null): void {
    if (liv) {
      this.formAjoutDette.livreurId = liv.livreurId;
    } else {
      this.formAjoutDette.livreurId = this.livreurs()[0]?.id || null;
    }
    this.formAjoutDette.montant = 0;
    this.formAjoutDette.date = new Date().toISOString().substring(0, 10);
    this.formAjoutDette.motif = '';
    this.modalAjoutDetteOuvert.set(true);
  }

  /**
   * Enregistre un règlement : DÉDUCTION AUTOMATIQUE ET IMMÉDIATE DU RESTE DE LA DETTE
   */
  protected enregistrerReglement(): void {
    const lSel = this.livreurSelectionneReglement();
    if (!lSel || this.formReglement.montant <= 0) {
      return;
    }

    const detteAvant = lSel.resteADevoir;
    const detteApres = Math.max(0, detteAvant - this.formReglement.montant);

    const nouveauReglement: ReglementDetteLivreur = {
      id: 'REG-' + Date.now(),
      livreurId: lSel.livreurId,
      livreurNom: lSel.livreurNom,
      livreurTelephone: lSel.livreurTelephone,
      montant: this.formReglement.montant,
      modePaiement: this.formReglement.modePaiement,
      dateReglement: this.formReglement.date,
      detteAvant: detteAvant,
      detteApres: detteApres,
      remarques: this.formReglement.remarques || 'Versement règlement dette',
    };

    // Ajouter à la liste des règlements
    const updated = [nouveauReglement, ...this.reglements()];
    this.reglements.set(updated);
    this.sauvegarderReglements(updated);

    this.modalReglementOuvert.set(false);
    if (detteApres === 0) {
      this.notificationSucces.set(
        `🎉 Règlement de ${nouveauReglement.montant.toLocaleString('fr-FR')} FCFA validé pour ${lSel.livreurNom}. La dette est ENTIÈREMENT SOLDÉE ! Ce compte est désormais archivé dans le journal ci-dessous.`
      );
    } else {
      this.notificationSucces.set(
        `Paiement de ${nouveauReglement.montant.toLocaleString('fr-FR')} FCFA enregistré pour ${lSel.livreurNom}. Déduction immédiate effectuée ! Reste dû : ${detteApres.toLocaleString('fr-FR')} FCFA.`
      );
    }

    // Effacer notification après 7 secondes
    setTimeout(() => this.notificationSucces.set(null), 7000);
  }

  /**
   * Enregistre une dette manuelle imputée au livreur
   */
  protected enregistrerAjoutDette(): void {
    const livreurId = this.formAjoutDette.livreurId;
    if (!livreurId || this.formAjoutDette.montant <= 0) return;

    const liv = this.livreurs().find((l) => l.id === livreurId);
    const nouvelleDette: DetteManuelle = {
      id: 'DETTE-' + Date.now(),
      livreurId: livreurId,
      montant: this.formAjoutDette.montant,
      motif: this.formAjoutDette.motif,
      date: this.formAjoutDette.date,
    };

    const updated = [nouvelleDette, ...this.dettesManuelles()];
    this.dettesManuelles.set(updated);
    this.sauvegarderDettesManuelles(updated);

    this.modalAjoutDetteOuvert.set(false);
    this.notificationSucces.set(
      `Dette de ${nouvelleDette.montant.toLocaleString('fr-FR')} FCFA ajoutée au compte de ${liv?.nom || 'Livreur'}.`,
    );

    setTimeout(() => this.notificationSucces.set(null), 6000);
  }

  private chargerDonneesLocales(): void {
    try {
      const dettesRaw = localStorage.getItem(STORAGE_DETTES_KEY);
      if (dettesRaw) {
        this.dettesManuelles.set(JSON.parse(dettesRaw));
      }

      const reglementsRaw = localStorage.getItem(STORAGE_REGLEMENTS_KEY);
      if (reglementsRaw) {
        this.reglements.set(JSON.parse(reglementsRaw));
      }
    } catch (e) {
      console.warn('Erreur lecture données locales', e);
    }
  }

  private sauvegarderReglements(data: ReglementDetteLivreur[]): void {
    try {
      localStorage.setItem(STORAGE_REGLEMENTS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Erreur sauvegarde règlements', e);
    }
  }

  private sauvegarderDettesManuelles(data: DetteManuelle[]): void {
    try {
      localStorage.setItem(STORAGE_DETTES_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Erreur sauvegarde dettes', e);
    }
  }

  private chargerDonneesServeur(): void {
    forkJoin({
      utilisateurs: this.utilisateurService.lister(),
      tournees: this.tourneeService.lister(),
    }).subscribe({
      next: ({ utilisateurs, tournees }) => {
        this.utilisateurs.set(utilisateurs);
        this.tournees.set(tournees);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
