export interface Client {
  id: number;
  nomBoutique: string;
  nomResponsable: string | null;
  telephone: string;
  zoneId: number | null;
  zoneNom: string | null;
  adresse: string | null;
  plafondCredit: number | null;
  actif: boolean;
}

export interface ClientRequest {
  nomBoutique: string;
  nomResponsable: string | null;
  telephone: string;
  zoneId: number | null;
  adresse: string | null;
  plafondCredit: number | null;
  actif: boolean;
  motDePasse?: string | null;
}

/** prixApplique = prix spécial s'il existe, sinon prix standard. */
export interface PrixClient {
  produitId: number;
  produitNom: string;
  prixStandard: number;
  prixSpecial: number | null;
  prixApplique: number;
}

