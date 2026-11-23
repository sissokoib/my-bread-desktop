import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { FooterComponent } from './footer/footer.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly utilisateur = this.auth.utilisateur;
  protected readonly estSuperAdmin = computed(() => this.auth.aRole('SUPER_ADMIN', 'PDG'));
  protected readonly abonnementExpire = computed(
    () => !!this.utilisateur()?.abonnementExpire && !this.estSuperAdmin(),
  );
  protected readonly enEssaiGratuit = computed(
    () => this.utilisateur()?.statutAbonnement === 'ESSAI_GRATUIT' && !this.estSuperAdmin(),
  );

  /** Sur tablette/mobile : indique si le tiroir menu est ouvert. */
  protected readonly menuMobileOuvert = signal(false);
  /** Sur grand écran : indique si la sidebar est repliée en mode plein écran. */
  protected readonly sidebarReplieeDesktop = signal(false);

  constructor() {
    // Refermer automatiquement le tiroir sur tablette/mobile dès qu'on change de page
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.menuMobileOuvert.set(false);
      });
  }

  protected basculerSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      this.menuMobileOuvert.update((v) => !v);
    } else {
      this.sidebarReplieeDesktop.update((v) => !v);
    }
  }

  protected fermerMenuMobile(): void {
    this.menuMobileOuvert.set(false);
  }
}
