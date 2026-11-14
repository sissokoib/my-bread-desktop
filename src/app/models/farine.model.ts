export interface BilanFarine {
  stockFarineSacs: number;
  seuilAlerteFarine: number;
  rendementBaguettesSac: number;
  sacsFarineUtilisesAujourdhui: number;
  baguettesProduitesAujourdhui: number;
  rendementReelAujourdhui: number;
  ecartBaguettesAujourdhui: number;
  statutRendement: 'OPTIMAL' | 'ATTENTION' | 'ALERTE' | 'NON_RENSEIGNE';
  joursAutonomieEstimes: number;
  alerteStockBas: boolean;
}

export interface ApprovisionnementFarineRequest {
  dateApprovisionnement?: string;
  nombreSacs: number;
  fournisseur?: string;
  prixTotal?: number;
  remarques?: string;
}

export interface ApprovisionnementFarine {
  id: number;
  dateApprovisionnement: string;
  nombreSacs: number;
  fournisseur: string;
  prixTotal: number;
  remarques: string | null;
  auteurNom?: string;
  auteurRole?: string;
  createdAt: string;
}

