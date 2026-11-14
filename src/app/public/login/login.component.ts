import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { messageErreur } from '../../services/message-erreur';

interface SlidePresentation {
  tag: string;
  titre: string;
  image: string;
}

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected telephone = '60797575';
  protected motDePasse = 'pass1234';
  protected readonly afficherMotDePasse = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);

  /** Diapositives modernes avec l'image du pain en animation */
  protected readonly slides: SlidePresentation[] = [
    {
      tag: '📱 GESTION DIGITALE COMPLÈTE',
      titre: 'Pilotez votre boulangerie depuis votre téléphone',
      image: 'images/pain-3d.png',
    },
    {
      tag: 'TOURNÉES & GESTION DES RETOURS',
      titre: 'Pains livrés & décomptes sans perte',
      image: 'images/pain-3d.png',
    },
    {
      tag: '📜 BULLETINS DE DÉCOMPTE OFFICIELS',
      titre: 'Bulletins certifiés en 1 clic',
      image: 'images/pain-3d.png',
    },
  ];

  protected readonly produitsDefilants = [
    'Baguette tradition',
    'Pain complet',
    'Croissant pur beurre',
    'Pain au chocolat',
    'Baguette sésame',
    'Brioche dorée',
    'Pain de mie artisanal',
  ];

  protected readonly slideActive = signal(0);
  private enPause = false;
  private readonly minuterie = setInterval(() => {
    if (!this.enPause) {
      this.slideActive.update((i) => (i + 1) % this.slides.length);
    }
  }, 4200);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.minuterie));
  }

  ngOnInit(): void {
    const msg =
      this.route.snapshot.queryParamMap.get('erreur') ||
      this.route.snapshot.queryParamMap.get('message');
    if (msg) {
      this.erreur.set(msg);
    }
  }

  protected allerA(index: number): void {
    this.slideActive.set(index);
  }

  protected pauseDefilement(pause: boolean): void {
    this.enPause = pause;
  }

  protected remplirIdentifiants(tel: string, mdp: string): void {
    this.telephone = tel;
    this.motDePasse = mdp;
  }

  protected motDePasseOublie(): void {
    this.erreur.set('Pour réinitialiser votre mot de passe, contactez l\'assistance My Bread au +223 60-79-75-75.');
  }

  protected inscrire(): void {
    this.erreur.set('Pour créer un nouveau fournil ou compte livreur, contactez l\'équipe My Bread au +223 60-79-75-75.');
  }

  protected soumettre(): void {
    const telBrut = this.telephone.trim();
    if (!telBrut || !this.motDePasse) {
      this.erreur.set('Veuillez saisir votre numéro de téléphone et votre mot de passe.');
      return;
    }

    // Normalisation du numéro pour envoyer propre au backend
    const tel = telBrut.replace(/[^0-9]/g, '');

    this.enCours.set(true);
    this.erreur.set(null);

    this.auth.login(tel, this.motDePasse).subscribe({
      next: (rep) => {
        this.enCours.set(false);
        if (rep.utilisateur.role === 'PDG') {
          this.auth.logout(false);
          this.erreur.set("L'accès PDG est réservé exclusivement à l'application mobile My Bread. Veuillez vous connecter depuis votre smartphone.");
          return;
        }
        if (rep.utilisateur.role === 'SUPER_ADMIN') {
          void this.router.navigate(['/super-admin']);
        } else {
          void this.router.navigate(['/tableau-de-bord']);
        }
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }
}
