import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { LayoutComponent } from './layout/layout.component';
import { BulletinsComponent } from './pages/bulletins/bulletins.component';
import { CaisseComponent } from './pages/caisse/caisse.component';
import { CommandesComponent } from './pages/commandes/commandes.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DepensesComponent } from './pages/depenses/depenses.component';
import { PaiementsComponent } from './pages/paiements/paiements.component';
import { ProductionsComponent } from './pages/productions/productions.component';
import { ProduitsComponent } from './pages/produits/produits.component';
import { ProfilComponent } from './pages/profil/profil.component';
import { SuperAdminComponent } from './pages/super-admin/super-admin.component';
import { TourneesComponent } from './pages/tournees/tournees.component';
import { UtilisateursComponent } from './pages/utilisateurs/utilisateurs.component';
import { ZonesComponent } from './pages/zones/zones.component';
import { LoginComponent } from './public/login/login.component';

export const routes: Routes = [
  // Au démarrage, l'application redirige directement vers le formulaire de connexion
  { path: '', pathMatch: 'full', redirectTo: 'connexion' },
  { path: 'connexion', component: LoginComponent },

  // Espace d'administration protégé par authGuard
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'tableau-de-bord', component: DashboardComponent },
      { path: 'caisse', component: CaisseComponent },
      { path: 'commandes', component: CommandesComponent },
      { path: 'productions', component: ProductionsComponent },
      { path: 'tournees', component: TourneesComponent },
      { path: 'bulletins', component: BulletinsComponent },
      { path: 'paiements', component: PaiementsComponent },
      { path: 'depenses', component: DepensesComponent },
      { path: 'produits', component: ProduitsComponent },
      { path: 'zones', component: ZonesComponent },
      { path: 'clients', redirectTo: 'commandes' },
      { path: 'profil', component: ProfilComponent },
      {
        path: 'super-admin',
        component: SuperAdminComponent,
        canActivate: [roleGuard('SUPER_ADMIN', 'PDG', 'ADMIN')],
      },
      {
        path: 'utilisateurs',
        component: UtilisateursComponent,
        canActivate: [roleGuard('SUPER_ADMIN', 'ADMIN')],
      },
    ],
  },

  // Redirection par défaut pour toute URL inconnue
  { path: '**', redirectTo: 'connexion' },
];
