import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  protected readonly utilisateur = this.auth.utilisateur;
  protected readonly estSuperAdmin = computed(() => this.auth.aRole('SUPER_ADMIN', 'PDG'));
  protected readonly abonnementExpire = computed(
    () => !!this.utilisateur()?.abonnementExpire && !this.estSuperAdmin(),
  );
  protected readonly enEssaiGratuit = computed(
    () => this.utilisateur()?.statutAbonnement === 'ESSAI_GRATUIT' && !this.estSuperAdmin(),
  );
}
