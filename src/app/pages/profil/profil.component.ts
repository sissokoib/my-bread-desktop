import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { resoudreUrlPhoto } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { messageErreur } from '../../services/message-erreur';

@Component({
  selector: 'app-profil',
  imports: [FormsModule],
  templateUrl: './profil.component.html',
  styleUrl: './profil.component.css',
})
export class ProfilComponent implements OnInit {
  private readonly auth = inject(AuthService);

  protected readonly utilisateur = this.auth.utilisateur;
  protected readonly afficherMdp = signal(false);
  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | null>(null);
  protected readonly succes = signal<string | null>(null);

  protected readonly urlPhotoAffichee = computed(() =>
    resoudreUrlPhoto(this.utilisateur()?.photoProfil),
  );

  protected nom = '';
  protected telephone = '';
  protected nouveauMotDePasse = '';
  protected confirmationMotDePasse = '';

  protected readonly avatarsPredefinis = [
    {
      label: 'Chef Boulanger Doré',
      dataUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='60' fill='%236F4518'/><circle cx='60' cy='60' r='54' fill='none' stroke='%23F4C542' stroke-width='3'/><path d='M32 76C32 56 44 44 60 44C76 44 88 56 88 76H32Z' fill='%23F4C542'/><rect x='26' y='76' width='68' height='12' rx='6' fill='%23D4A017'/><path d='M48 52L44 64M60 50V63M72 52L76 64' stroke='%236F4518' stroke-width='4' stroke-linecap='round'/></svg>",
    },
    {
      label: 'Épi de Blé Royal',
      dataUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='60' fill='%238B5A2B'/><circle cx='60' cy='60' r='54' fill='none' stroke='%23FDE68A' stroke-width='3'/><path d='M60 22V98' stroke='%23F4C542' stroke-width='5' stroke-linecap='round'/><ellipse cx='48' cy='42' rx='8' ry='14' transform='rotate(-28 48 42)' fill='%23F4C542'/><ellipse cx='72' cy='42' rx='8' ry='14' transform='rotate(28 72 42)' fill='%23F4C542'/><ellipse cx='48' cy='64' rx='8' ry='14' transform='rotate(-28 48 64)' fill='%23D4A017'/><ellipse cx='72' cy='64' rx='8' ry='14' transform='rotate(28 72 64)' fill='%23D4A017'/></svg>",
    },
    {
      label: 'Maître du Fournil',
      dataUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='60' fill='%232C1810'/><circle cx='60' cy='60' r='54' fill='none' stroke='%23D4A017' stroke-width='3'/><path d='M40 50C34 50 30 44 30 38C30 31 36 26 43 27C46 21 52 18 60 18C68 18 74 21 77 27C84 26 90 31 90 38C90 44 86 50 80 50V66H40V50Z' fill='%23FAF9F6'/><rect x='40' y='62' width='40' height='10' rx='3' fill='%23F4C542'/><circle cx='60' cy='86' r='10' fill='%23D4A017'/></svg>",
    },
  ];

  ngOnInit(): void {
    this.reinitialiserFormulaire();
  }

  protected reinitialiserFormulaire(): void {
    const u = this.utilisateur();
    if (!u) return;
    this.nom = u.nom;
    this.telephone = u.telephone;
    this.nouveauMotDePasse = '';
    this.confirmationMotDePasse = '';
    this.erreur.set(null);
  }

  protected initiales(nom: string): string {
    return nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected libelleRole(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'PDG':
        return 'PDG';
      case 'ADMIN':
        return 'Gérant';
      case 'LIVREUR':
        return 'Livreur';
      default:
        return 'Gérant';
    }
  }

  /**
   * Envoie directement le fichier image sélectionné vers POST /api/auth/me/photo (multipart/form-data).
   * Le fichier est stocké dans my-bread-backend/uploads/ et seule son URL "/uploads/..." est en BDD.
   */
  protected surSelectionFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    if (!fichier) return;

    if (!fichier.type.startsWith('image/')) {
      this.erreur.set('Veuillez sélectionner un fichier image valide (PNG, JPG, WEBP, SVG…).');
      return;
    }

    this.enCours.set(true);
    this.erreur.set(null);
    this.succes.set(null);

    this.auth.televerserPhotoProfil(fichier).subscribe({
      next: (u) => {
        this.enCours.set(false);
        this.succes.set(
          `Photo enregistrée dans le dossier uploads (${u.photoProfil}) et URL sauvegardée en base !`,
        );
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
    input.value = '';
  }

  protected appliquerAvatarPredefini(dataUrl: string): void {
    const u = this.utilisateur();
    if (!u) return;
    this.enCours.set(true);
    this.erreur.set(null);
    this.succes.set(null);

    this.auth
      .mettreAJourProfil({
        nom: this.nom.trim() || u.nom,
        telephone: this.telephone.trim() || u.telephone,
        photoProfil: dataUrl,
        nouveauMotDePasse: null,
      })
      .subscribe({
        next: (maj) => {
          this.enCours.set(false);
          this.succes.set(
            `Emblème enregistré dans uploads (${maj.photoProfil}) et URL stockée en base !`,
          );
        },
        error: (err) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }

  protected supprimerPhoto(): void {
    this.enCours.set(true);
    this.erreur.set(null);
    this.succes.set(null);

    this.auth.supprimerPhotoProfil().subscribe({
      next: () => {
        this.enCours.set(false);
        this.succes.set('Photo supprimée du dossier uploads et de la base de données.');
      },
      error: (err) => {
        this.enCours.set(false);
        this.erreur.set(messageErreur(err));
      },
    });
  }

  protected enregistrerProfil(): void {
    const nomNettoye = this.nom.trim();
    const telNettoye = this.telephone.trim();
    if (!nomNettoye || !telNettoye) {
      this.erreur.set('Le nom complet et le numéro de téléphone sont obligatoires.');
      return;
    }

    if (this.nouveauMotDePasse.trim()) {
      if (this.nouveauMotDePasse.trim().length < 6) {
        this.erreur.set('Le nouveau mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (this.nouveauMotDePasse !== this.confirmationMotDePasse) {
        this.erreur.set('La confirmation du mot de passe ne correspond pas.');
        return;
      }
    }

    this.enCours.set(true);
    this.erreur.set(null);
    this.succes.set(null);

    this.auth
      .mettreAJourProfil({
        nom: nomNettoye,
        telephone: telNettoye,
        photoProfil: null,
        nouveauMotDePasse: this.nouveauMotDePasse.trim() ? this.nouveauMotDePasse.trim() : null,
      })
      .subscribe({
        next: () => {
          this.enCours.set(false);
          this.nouveauMotDePasse = '';
          this.confirmationMotDePasse = '';
          this.succes.set('Vos informations de profil ont été enregistrées avec succès !');
        },
        error: (err) => {
          this.enCours.set(false);
          this.erreur.set(messageErreur(err));
        },
      });
  }
}
