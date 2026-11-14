import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { resoudreUrlPhoto } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly utilisateur = this.auth.utilisateur;
  protected termeRecherche = '';

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
    } else if (q.includes('comm')) {
      void this.router.navigate(['/commandes']);
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
    } else if (q.includes('util') || q.includes('equipe') || q.includes('user') || q.includes('compte')) {
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
