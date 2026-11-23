import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { resoudreUrlPhoto } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  protected readonly utilisateur = this.auth.utilisateur;
  @Output() readonly fermerMenu = new EventEmitter<void>();
  protected readonly estSuperAdmin = computed(() => this.auth.aRole('SUPER_ADMIN', 'PDG'));
  protected readonly estAdmin = computed(() => this.auth.aRole('SUPER_ADMIN', 'ADMIN'));
  protected photoErreur = false;

  protected onPhotoError(): void {
    this.photoErreur = true;
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

  protected deconnecter(): void {
    this.auth.logout();
  }
}
