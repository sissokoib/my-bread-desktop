export interface Produit {
  id: number;
  nom: string;
  prixVente: number;
  coutRevient: number;
  actif: boolean;
}

export interface ProduitRequest {
  nom: string;
  prixVente: number;
  coutRevient: number | null;
  actif: boolean;
}

