import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoulangerieDialogComponent } from '../../dialogs/boulangerie-dialog.component';
import { MotDePasseDialogComponent } from '../../dialogs/mot-de-passe-dialog.component';
import { UtilisateurDialogComponent } from '../../dialogs/utilisateur-dialog.component';
import { Boulangerie, PlanAbonnement, Role, StatutAbonnement, SuperAdminPlateforme, Utilisateur } from '../../models/utilisateur.model';
import { resoudreUrlPhoto } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { messageErreur } from '../../services/message-erreur';
import { SuperAdminService } from '../../services/super-admin.service';

@Component({
  selector: 'app-super-admin',
  imports: [FormsModule,
    DecimalPipe,
    DatePipe,
    UtilisateurDialogComponent,
    MotDePasseDialogComponent,
    BoulangerieDialogComponent,],
  templateUrl: './super-admin.component.html',
  styleUrl: './super-admin.component.css',
})
export class SuperAdminComponent implements OnInit {
  private readonly service = inject(SuperAdminService);
  private readonly auth = inject(AuthService);

  protected readonly resoudreUrlPhoto = resoudreUrlPhoto;

  protected initiales(nom?: string | null): string {
    if (!nom) return 'U';
    const parts = nom.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nom.slice(0, 2).toUpperCase();
  }

  // State
  protected readonly plateforme = signal<SuperAdminPlateforme | null>(null);
  protected readonly boulangeries = signal<Boulangerie[]>([]);
  protected readonly recherche = signal('');
  protected readonly roleFiltre = signal<Role | null>(null);
  protected readonly boulangerieFiltre = signal<number | null>(null);
  protected readonly ongletStatut = signal<'TOUS' | 'ACTIFS' | 'ESSAI' | 'ALERTES'>('TOUS');

  protected readonly erreur = signal<string | null>(null);
  protected readonly succes = signal<string | null>(null);

  protected readonly dialogCreationOuvert = signal(false);
  protected readonly dialogBoulangerieOuvert = signal(false);
  protected readonly utilisateurMdp = signal<Utilisateur | null>(null);
  protected readonly utilisateurAEditer = signal<Utilisateur | null>(null);

  protected readonly monTelephone = computed(() => this.auth.utilisateur()?.telephone ?? '');

  // Computed analytics
  protected readonly nbBoulangeriesActives = computed(() =>
    this.boulangeries().filter((b) => b.actif && !b.expire).length,
  );

  protected readonly boulangeriesEnAlerte = computed(() =>
    this.boulangeries().filter((b) => b.expire || b.joursRestants <= 7),
  );

  protected readonly tauxRetention = computed(() => {
    const total = this.boulangeries().length;
    if (total === 0) return 100;
    const actifs = this.nbBoulangeriesActives();
    return Math.round((actifs / total) * 100);
  });

  protected readonly topBoulangeriesParCA = computed(() => {
    return [...this.boulangeries()].sort((a, b) => (b.caTotal ?? 0) - (a.caTotal ?? 0));
  });

  protected readonly maxCA = computed(() => {
    const list = this.boulangeries();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((b) => b.caTotal || 0));
    return max > 0 ? max : 1;
  });

  protected readonly donutSegments = computed(() => {
    const list = this.boulangeries();
    const total = list.length || 1;
    const nbActifs = list.filter((b) => b.statutAbonnement === 'ACTIF' && !b.expire).length;
    const nbEssai = list.filter((b) => b.statutAbonnement === 'ESSAI_GRATUIT' && !b.expire).length;
    const nbExpires = list.filter((b) => b.expire || b.statutAbonnement === 'EXPIRE').length;
    const nbSuspendus = list.filter((b) => b.statutAbonnement === 'SUSPENDU' || !b.actif).length;

    const C = 2 * Math.PI * 38; // approx 238.76

    const pActifs = nbActifs / total;
    const pEssai = nbEssai / total;
    const pExpires = nbExpires / total;

    const actifsLen = pActifs * C;
    const essaisLen = pEssai * C;
    const expiresLen = pExpires * C;

    return {
      nbActifs,
      nbEssai,
      nbExpires,
      nbSuspendus,
      actifsDash: `${actifsLen} ${C - actifsLen}`,
      essaisDash: `${essaisLen} ${C - essaisLen}`,
      essaisOffset: `-${actifsLen}`,
      expiresDash: `${expiresLen} ${C - expiresLen}`,
      expiresOffset: `-${actifsLen + essaisLen}`,
    };
  });

  protected readonly nbMembresParBoulangerie = computed(() => {
    const map = new Map<number, number>();
    for (const u of this.plateforme()?.comptes ?? []) {
      if (u.boulangerieId) {
        map.set(u.boulangerieId, (map.get(u.boulangerieId) ?? 0) + 1);
      }
    }
    return map;
  });

  protected readonly nomBoulangerieFiltree = computed(() => {
    const bId = this.boulangerieFiltre();
    if (bId === null) return null;
    const b = this.boulangeries().find((item) => item.id === bId);
    return b ? b.nom : null;
  });

  protected readonly boulangeriesFiltrees = computed(() => {
    const list = this.boulangeries();
    const onglet = this.ongletStatut();
    if (onglet === 'ACTIFS') {
      return list.filter((b) => b.actif && !b.expire);
    }
    if (onglet === 'ESSAI') {
      return list.filter((b) => b.statutAbonnement === 'ESSAI_GRATUIT' && !b.expire);
    }
    if (onglet === 'ALERTES') {
      return list.filter((b) => b.expire || b.joursRestants <= 7);
    }
    return list;
  });

  protected readonly comptesFiltres = computed(() => {
    const liste = this.plateforme()?.comptes ?? [];
    const q = this.recherche().trim().toLowerCase();
    const role = this.roleFiltre();
    const bId = this.boulangerieFiltre();
    return liste.filter((u) => {
      if (bId !== null && u.boulangerieId !== bId) {
        return false;
      }
      if (role !== null && u.role !== role) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        u.nom.toLowerCase().includes(q) ||
        u.telephone.includes(q) ||
        (u.boulangerieNom && u.boulangerieNom.toLowerCase().includes(q))
      );
    });
  });

  ngOnInit(): void {
    this.chargerTout();
  }

  protected chargerTout(): void {
    this.chargerPlateforme();
    this.chargerBoulangeries();
  }

  protected chargerPlateforme(): void {
    this.service.obtenirVuePlateforme().subscribe({
      next: (res) => {
        this.plateforme.set(res);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected chargerBoulangeries(): void {
    this.service.listerBoulangeries().subscribe({
      next: (res) => {
        this.boulangeries.set(res);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  // Helpers visualisation
  protected calculerHauteurBarre(ca?: number | null): number {
    const montant = ca || 0;
    const max = this.maxCA();
    const pct = Math.round((montant / max) * 100);
    return Math.max(pct, 6);
  }

  protected calcGauge(val: number, max: number): number {
    return Math.min(Math.round((val / max) * 100), 100);
  }

  protected tronquerTexte(txt: string, max: number): string {
    if (!txt) return '';
    return txt.length > max ? txt.slice(0, max) + '…' : txt;
  }

  protected countPlan(plan: PlanAbonnement): number {
    return this.boulangeries().filter((b) => b.plan === plan).length;
  }

  // Color hash generator for bakery pills
  protected couleurBoulangerie(nom?: string | null): string {
    if (!nom) return '#8B5A2B';
    const palette = ['#B45309', '#047857', '#1D4ED8', '#6D28D9', '#BE185D', '#C2410C', '#4338CA'];
    let hash = 0;
    for (let i = 0; i < nom.length; i++) {
      hash = (hash << 5) - hash + nom.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  }

  protected fondBoulangerie(nom?: string | null): string {
    if (!nom) return '#FFFDF8';
    const paletteFonds = ['#FEF3C7', '#D1FAE5', '#DBEAFE', '#EDE9FE', '#FCE7F3', '#FFEDD5', '#E0E7FF'];
    let hash = 0;
    for (let i = 0; i < nom.length; i++) {
      hash = (hash << 5) - hash + nom.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % paletteFonds.length;
    return paletteFonds[idx];
  }

  // Actions
  protected filtrerUtilisateursParBoulangerie(boulangerieId: number): void {
    this.boulangerieFiltre.set(boulangerieId);
    setTimeout(() => {
      const el = document.getElementById('section-utilisateurs');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }

  protected reinitialiserFiltresUtilisateurs(): void {
    this.boulangerieFiltre.set(null);
    this.roleFiltre.set(null);
    this.recherche.set('');
  }

  protected exporterRapportCSV(): void {
    const list = this.boulangeries();
    const plat = this.plateforme();
    const dateStr = new Date().toISOString().split('T')[0];

    const lignes: string[] = [];
    lignes.push('=== RAPPORT D\'AUDIT SAAS MY BREAD ENTERPRISE ===');
    lignes.push(`Date d'export;${new Date().toLocaleString('fr-FR')}`);
    lignes.push(`Total Boulangeries;${list.length}`);
    lignes.push(`Chiffre d'affaires global (FCFA);${plat?.chiffreAffairesGlobal ?? 0}`);
    lignes.push(`Total Encaissé global (FCFA);${plat?.encaisseGlobal ?? 0}`);
    lignes.push(`Dettes globales (FCFA);${plat?.dettesGlobales ?? 0}`);
    lignes.push('');
    lignes.push('ID;Boulangerie;Téléphone;Plan;Statut Abonnement;Jours Restants;Date Échéance;Livreurs;CA Total (FCFA)');

    for (const b of list) {
      lignes.push(
        [
          b.id,
          `"${b.nom.replace(/"/g, '""')}"`,
          b.telephone,
          b.plan,
          b.statutAbonnement,
          b.joursRestants,
          b.dateFinAbonnement,
          b.nbLivreurs,
          b.nbClients,
          b.caTotal || 0,
        ].join(';'),
      );
    }

    const blob = new Blob(['\uFEFF' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport-saas-mybread-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.succes.set('Rapport d\'audit CSV téléchargé avec succès.');
  }

  protected apresCreationBoulangerie(b: Boulangerie): void {
    this.dialogBoulangerieOuvert.set(false);
    this.succes.set(
      `Boulangerie "${b.nom}" créée avec succès avec 14 jours d'essai gratuit. Son gérant peut maintenant se connecter !`,
    );
    this.chargerTout();
  }

  protected prolongerAbonnementManuel(b: Boulangerie, jours: number): void {
    const note = prompt(
      `Prolonger l'abonnement de "${b.nom}" de ${jours} jours.\nAjouter une note de règlement manuel (ex: Payé 30 000 FCFA en espèces / Wave) :`,
      `Règlement manuel de ${jours} jours reçu`,
    );
    if (note === null) return;

    this.erreur.set(null);
    this.succes.set(null);
    this.service.prolongerAbonnement(b.id, { joursSupplementaires: jours, notesPaiementManuel: note }).subscribe({
      next: (updated) => {
        this.succes.set(
          `L'abonnement de "${updated.nom}" a été prolongé jusqu'au ${updated.dateFinAbonnement} (+${jours} jours).`,
        );
        this.chargerBoulangeries();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected simulerFinEssai(b: Boulangerie): void {
    if (
      !confirm(
        `Confirmer la fin d'essai immédiate pour "${b.nom}" ?\nLe compte du gérant sera automatiquement désactivé et l'accès à l'interface bloqué.`,
      )
    ) {
      return;
    }

    this.erreur.set(null);
    this.succes.set(null);
    this.service.forcerExpirationEssai(b.id).subscribe({
      next: (maj) => {
        this.succes.set(
          `L'essai de "${maj.nom}" est terminé. La boulangerie et le compte du gérant sont automatiquement désactivés.`,
        );
        this.chargerTout();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected basculerStatutBoulangerie(b: Boulangerie): void {
    this.erreur.set(null);
    this.succes.set(null);
    this.service.changerStatutBoulangerie(b.id, !b.actif).subscribe({
      next: (updated) => {
        this.succes.set(
          `La boulangerie "${updated.nom}" a été ${updated.actif ? 'réactivée' : 'suspendue'}.`,
        );
        this.chargerBoulangeries();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected ouvrirCreationCompte(): void {
    this.dialogCreationOuvert.set(true);
  }

  protected apresCreationCompte(): void {
    this.dialogCreationOuvert.set(false);
    this.succes.set('Nouveau compte créé avec succès sur la plateforme.');
    this.chargerTout();
  }

  protected apresModificationCompte(): void {
    this.utilisateurAEditer.set(null);
    this.succes.set('Compte utilisateur et rattachement boulangerie mis à jour avec succès.');
    this.chargerTout();
  }

  protected apresChangementMdp(): void {
    this.utilisateurMdp.set(null);
    this.succes.set('Mot de passe mis à jour par le Super-Administrateur.');
  }

  protected basculerStatut(u: Utilisateur): void {
    this.erreur.set(null);
    this.succes.set(null);
    this.service.changerStatutCompte(u.id, !u.actif).subscribe({
      next: () => {
        this.succes.set(
          `Le compte de ${u.nom} (${u.telephone}) a été ${!u.actif ? 'activé' : 'suspendu'}.`,
        );
        this.chargerTout();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected changerRole(u: Utilisateur, nouveauRole: Role): void {
    this.erreur.set(null);
    this.succes.set(null);
    this.service.changerRoleCompte(u.id, nouveauRole).subscribe({
      next: () => {
        this.succes.set(`Rôle de ${u.nom} changé en ${nouveauRole}.`);
        this.chargerTout();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }

  protected purgerOperations(): void {
    if (
      !confirm(
        'Confirmez-vous la réinitialisation de toutes les opérations (commandes, livraisons, paiements, tournées, fournées et dépenses) ?',
      )
    ) {
      return;
    }
    this.service.reinitialiserOperations().subscribe({
      next: () => {
        this.succes.set('Toutes les opérations transactionnelles ont été purgées.');
        this.chargerTout();
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}
