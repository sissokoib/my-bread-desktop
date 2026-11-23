import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { chargerIntrantsFournil } from '../../pages/productions/productions.component';
import { resoudreUrlPhoto } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { CommandeService } from '../../services/commande.service';
import { FarineService } from '../../services/farine.service';
import { TourneeService } from '../../services/tournee.service';

export interface AlerteHeader {
  id: string;
  titre: string;
  detail: string;
  lien: string;
  niveau: 'warn' | 'danger' | 'info';
  icone: string;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly farineService = inject(FarineService);
  private readonly commandeService = inject(CommandeService);
  private readonly tourneeService = inject(TourneeService);

  protected readonly utilisateur = this.auth.utilisateur;
  @Output() readonly toggleMenu = new EventEmitter<void>();
  protected termeRecherche = '';
  protected readonly photoErreur = signal(false);
  protected readonly menuAlertesOuvert = signal(false);
  protected readonly alertes = signal<AlerteHeader[]>([]);

  protected readonly nbAlertes = computed(() => this.alertes().length);

  ngOnInit(): void {
    this.actualiserAlertes();
  }

  protected basculerMenuAlertes(): void {
    if (!this.menuAlertesOuvert()) {
      this.actualiserAlertes();
    }
    this.menuAlertesOuvert.update((v) => !v);
  }

  protected actualiserAlertes(): void {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    forkJoin({
      bilanFarine: this.farineService.obtenirBilan().pipe(catchError(() => of(null))),
      commandes: this.commandeService.lister().pipe(catchError(() => of([]))),
      tournees: this.tourneeService.lister(aujourdhui).pipe(catchError(() => of([]))),
    }).subscribe(({ bilanFarine, commandes, tournees }) => {
      const liste: AlerteHeader[] = [];

      if (bilanFarine && (bilanFarine.alerteStockBas || bilanFarine.stockFarineSacs <= 10)) {
        liste.push({
          id: 'farine-bas',
          titre: `Stock de farine bas (${bilanFarine.stockFarineSacs} sacs)`,
          detail: 'Pensez à enregistrer un réapprovisionnement de farine.',
          lien: '/productions',
          niveau: 'danger',
          icone: 'grain',
        });
      }

      const intrantsBas = chargerIntrantsFournil().filter((i) => i.quantite <= i.seuilAlerte);
      if (intrantsBas.length > 0) {
        liste.push({
          id: 'intrants-bas',
          titre: `${intrantsBas.length} intrant(s) du fournil en stock bas`,
          detail: intrantsBas.map((i) => `${i.nom} (${i.quantite})`).join(', '),
          lien: '/productions',
          niveau: 'warn',
          icone: 'inventory_2',
        });
      }

      const cmdEnAttente = (commandes || []).filter((c) => c.statut === 'EN_ATTENTE');
      if (cmdEnAttente.length > 0) {
        liste.push({
          id: 'cmd-attente',
          titre: `${cmdEnAttente.length} commande(s) client en attente`,
          detail: 'À valider pour planifier les fournées.',
          lien: '/commandes',
          niveau: 'warn',
          icone: 'pending_actions',
        });
      }

      const tourneesEnCours = (tournees || []).filter((t) => t.statut !== 'CLOTUREE');
      if (tourneesEnCours.length > 0) {
        liste.push({
          id: 'tournees-ouvertes',
          titre: `${tourneesEnCours.length} tournée(s) livreur en vente`,
          detail: 'Pensez à décompter les retours et encaisser les versements.',
          lien: '/tournees',
          niveau: 'info',
          icone: 'local_shipping',
        });
      }

      this.alertes.set(liste);
    });
  }

  protected onPhotoError(): void {
    this.photoErreur.set(true);
  }

  protected urlPhoto(photoProfil?: string | null): string | null {
    return resoudreUrlPhoto(photoProfil);
  }

  protected initiales(nom: string): string {
    return nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected executerRechercheRapide(): void {
    const q = this.termeRecherche.trim().toLowerCase();
    if (!q) return;
    if (q.includes('fourn') || q.includes('prod') || q.includes('stock')) {
      void this.router.navigate(['/productions']);
    } else if (q.includes('comm') || q.includes('vente')) {
      void this.router.navigate(['/commandes']);
    } else if (q.includes('caisse') || q.includes('clotur') || q.includes('tresor')) {
      void this.router.navigate(['/caisse']);
    } else if (q.includes('bulletin') || q.includes('decompte') || q.includes('bilan')) {
      void this.router.navigate(['/bulletins']);
    } else if (q.includes('tourn') || q.includes('livr') || q.includes('pain')) {
      void this.router.navigate(['/tournees']);
    } else if (q.includes('paie') || q.includes('dette') || q.includes('solde') || q.includes('rembours')) {
      void this.router.navigate(['/paiements']);
    } else if (q.includes('dep') || q.includes('charg') || q.includes('farine') || q.includes('intrant')) {
      void this.router.navigate(['/depenses']);
    } else if (q.includes('tarif') || q.includes('baguette') || q.includes('prix')) {
      void this.router.navigate(['/produits']);
    } else if (q.includes('util') || q.includes('equipe') || q.includes('user') || q.includes('compte') || q.includes('ration') || q.includes('avance')) {
      void this.router.navigate(['/utilisateurs']);
    } else if (q.includes('prof') || q.includes('photo') || q.includes('mot de passe')) {
      void this.router.navigate(['/profil']);
    } else if (q.includes('super') || q.includes('back') || q.includes('boulangerie') || q.includes('abonnement')) {
      void this.router.navigate(['/super-admin']);
    } else {
      void this.router.navigate(['/tableau-de-bord']);
    }
    this.termeRecherche = '';
  }
}
