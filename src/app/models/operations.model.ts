export type StatutTournee = 'PREPAREE' | 'EN_COURS' | 'CLOTUREE';
export type MotifRetour = 'INVENDU' | 'ABIME' | 'PERTE';
export type ModePaiement = 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE' | 'VIREMENT';
export type CategorieDepense =
  | 'FARINE'
  | 'LEVURE_INTRANTS'
  | 'BOIS_GAZ'
  | 'ELECTRICITE_EAU'
  | 'SALAIRE'
  | 'TRANSPORT'
  | 'ENTRETIEN'
  | 'AUTRE';

export interface LigneQuantiteRequest {
  produitId: number;
  quantite: number;
}

export interface LigneProductionItem {
  produitId: number;
  produitNom: string;
  quantite: number;
  valeurVente: number;
  coutRevient: number;
}

export interface Production {
  id: number;
  dateProduction: string;
  remarques: string | null;
  sacsFarineUtilises?: number;
  rendementObtenu?: number;
  createdAt: string;
  totalQuantite: number;
  valeurVenteTotale: number;
  coutRevientTotal: number;
  lignes: LigneProductionItem[];
}

export interface ProductionRequest {
  dateProduction: string;
  remarques: string | null;
  sacsFarineUtilises?: number;
  lignes: LigneQuantiteRequest[];
}

export interface BilanProduitTournee {
  produitId: number;
  produitNom: string;
  quantiteChargee: number;
  quantiteLivree: number;
  quantiteRetournee: number;
  ecart: number;
}

export interface RetourPainItem {
  id: number;
  produitId: number;
  produitNom: string;
  quantite: number;
  motif: MotifRetour;
}

export interface Tournee {
  id: number;
  dateTournee: string;
  livreurId: number;
  livreurNom: string;
  livreurTelephone: string;
  statut: StatutTournee;
  heureDepart: string | null;
  heureRetour: string | null;
  remarques: string | null;
  nombreLivraisons: number;
  totalVentes: number;
  totalEncaisse: number;
  bilansProduits: BilanProduitTournee[];
  retours: RetourPainItem[];
}

export interface TourneeCreationRequest {
  dateTournee: string;
  livreurId: number;
  nomLivreurLibre?: string | null;
  remarques: string | null;
  chargements: LigneQuantiteRequest[];
}

export interface RetourPainRequest {
  produitId: number;
  quantite: number;
  motif: MotifRetour;
}

export interface TourneeClotureRequest {
  retours: RetourPainRequest[];
  remarques: string | null;
}

export interface LigneLivraisonItem {
  produitId: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

export interface Livraison {
  id: number;
  uuid: string;
  tourneeId: number;
  livreurId: number;
  livreurNom: string;
  clientId: number;
  clientNomBoutique: string;
  dateLivraison: string;
  montantTotal: number;
  remarques: string | null;
  lignes: LigneLivraisonItem[];
}

export interface LivraisonCreationRequest {
  uuid?: string;
  tourneeId: number;
  clientId: number;
  lignes: LigneQuantiteRequest[];
  montantPaye: number | null;
  modePaiement: ModePaiement | null;
  remarques: string | null;
}

export interface Paiement {
  id: number;
  uuid: string;
  clientId: number;
  clientNomBoutique: string;
  livraisonId: number | null;
  tourneeId: number | null;
  montant: number;
  modePaiement: ModePaiement;
  datePaiement: string;
  remarques: string | null;
}

export interface PaiementCreationRequest {
  uuid?: string;
  clientId?: number;
  livraisonId?: number | null;
  tourneeId?: number | null;
  montant: number;
  modePaiement: ModePaiement;
  remarques?: string | null;
}

export interface ClientSolde {
  clientId: number;
  nomBoutique: string;
  nomResponsable: string | null;
  telephone: string;
  zoneNom: string | null;
  totalLivraisons: number;
  totalPaiements: number;
  solde: number;
  plafondCredit: number | null;
  depassePlafond: boolean;
}

export interface ReglementDetteLivreur {
  id: string;
  livreurId: number;
  livreurNom: string;
  livreurTelephone: string;
  montant: number;
  modePaiement: ModePaiement;
  dateReglement: string;
  detteAvant: number;
  detteApres: number;
  remarques?: string;
}

export interface DetteLivreur {
  livreurId: number;
  livreurNom: string;
  livreurTelephone: string;
  detteInitiale: number;
  totalVentesTournees: number;
  totalEncaisseTournees: number;
  detteCumulee: number;
  totalRegle: number;
  resteADevoir: number;
  derniereDateReglement?: string;
  nombreTournees: number;
}


export interface Depense {
  id: number;
  dateDepense: string;
  categorie: CategorieDepense;
  montant: number;
  libelle: string;
}

export interface DepenseRequest {
  dateDepense: string;
  categorie: CategorieDepense;
  montant: number;
  libelle: string;
}

export interface DashboardResume {
  date: string;
  ventesJour: number;
  encaisseJour: number;
  depensesJour: number;
  coutProductionJour: number;
  beneficeEstimeJour: number;
  dettesTotales: number;
  quantiteProduiteJour: number;
  quantiteLivreeJour: number;
  quantiteRetourneeJour: number;
  tourneesEnCours: number;
  principauxDebiteurs: ClientSolde[];
}

export type StatutCommande = 'EN_ATTENTE' | 'VALIDEE' | 'PREPAREE' | 'LIVREE' | 'ANNULEE';

export interface LigneCommandeItem {
  produitId: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

export interface Commande {
  id: number;
  uuid: string;
  clientId: number | null;
  clientNomBoutique: string | null;
  clientZoneNom: string | null;
  livreurId: number;
  livreurNom: string;
  dateLivraisonSouhaitee: string;
  statut: StatutCommande;
  montantTotal: number;
  remarques: string | null;
  createdAt: string;
  lignes: LigneCommandeItem[];
}

export interface CommandeCreationRequest {
  uuid?: string;
  clientId?: number | null;
  livreurId?: number;
  dateLivraisonSouhaitee: string;
  lignes: LigneQuantiteRequest[];
  remarques: string | null;
  typeCommande?: 'DIRECTE' | 'PRECOMMANDE';
}

export interface StockDisponible {
  produitId: number;
  produitNom: string;
  date: string;
  quantiteProduite: number;
  quantiteCommandee: number;
  stockDisponible: number;
  quantiteRetoursInvendus?: number;
}



