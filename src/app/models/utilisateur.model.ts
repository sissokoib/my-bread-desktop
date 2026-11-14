export type Role = 'SUPER_ADMIN' | 'PDG' | 'ADMIN' | 'GESTIONNAIRE' | 'LIVREUR' | 'BOUTIQUIER' | 'EMPLOYE';

export type PlanAbonnement = 'STARTER' | 'PRO' | 'RESEAU';
export type StatutAbonnement = 'ESSAI_GRATUIT' | 'ACTIF' | 'EXPIRE' | 'SUSPENDU';

export interface SuperAdminPlateforme {
  totalUtilisateurs: number;
  totalSuperAdmins: number;
  totalAdmins: number;
  totalGestionnaires: number;
  totalLivreurs: number;
  totalBoutiquiers: number;
  totalProduits: number;
  totalZones: number;
  totalProductions: number;
  totalTournees: number;
  totalLivraisons: number;
  totalCommandes: number;
  totalPaiements: number;
  totalDepenses: number;
  chiffreAffairesGlobal: number;
  encaisseGlobal: number;
  depensesGlobales: number;
  dettesGlobales: number;
  comptes: Utilisateur[];
}

export interface Boulangerie {
  id: number;
  nom: string;
  adresse?: string | null;
  telephone: string;
  email?: string | null;
  plan: PlanAbonnement;
  statutAbonnement: StatutAbonnement;
  dateCreation: string;
  dateFinAbonnement: string;
  joursRestants: number;
  expire: boolean;
  contactCommercial?: string | null;
  notes?: string | null;
  actif: boolean;
  nbLivreurs: number;
  nbClients: number;
  caTotal: number;
}

export interface BoulangerieCreationRequest {
  nom: string;
  adresse?: string;
  telephone: string;
  email?: string;
  plan: PlanAbonnement;
  dureeEssaiJours?: number;
  gerantNom: string;
  gerantTelephone: string;
  gerantMotDePasse: string;
  contactCommercial?: string;
}

export interface ProlongerAbonnementRequest {
  joursSupplementaires: number;
  notesPaiementManuel?: string;
}

export interface Utilisateur {
  id: number;
  nom: string;
  telephone: string;
  role: Role;
  actif: boolean;
  photoProfil?: string | null;
  boulangerieId?: number | null;
  boulangerieNom?: string | null;
  statutAbonnement?: StatutAbonnement | null;
  joursRestantsAbonnement?: number | null;
  abonnementExpire?: boolean;
  contactCommercial?: string;
  quartier?: string | null;
  poste?: string | null;
  frequencePaie?: 'QUINZAINE' | 'MENSUEL' | string;
  salaireBase?: number;
  rationJournaliere?: number;
  totalDeductions?: number;
  salaireNet?: number;
  nombreAbsences?: number;
}

export interface AbsenceEmploye {
  id: number;
  utilisateurId: number;
  employeNom: string;
  dateAbsence: string;
  typeGarde: string;
  motif?: string | null;
  montantDeduit: number;
  createdAt: string;
}

export interface AbsenceCreationRequest {
  dateAbsence: string;
  typeGarde?: string;
  motif?: string;
  montantDeduit?: number;
}

export interface ProfilModificationRequest {
  nom: string;
  telephone: string;
  photoProfil?: string | null;
  nouveauMotDePasse?: string | null;
}

export interface UtilisateurCreation {
  nom: string;
  telephone: string;
  motDePasse?: string;
  role?: Role;
  boulangerieId?: number | null;
  quartier?: string;
  poste?: string;
  frequencePaie?: string;
  salaireBase?: number;
  rationJournaliere?: number;
}

export interface UtilisateurModification {
  nom: string;
  telephone: string;
  role: Role;
  actif: boolean;
  boulangerieId?: number | null;
}

export interface LoginResponse {
  token: string;
  expireDansSecondes: number;
  utilisateur: Utilisateur;
}
