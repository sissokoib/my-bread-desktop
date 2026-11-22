export interface Produit {
  id: number;
  nom: string;
  prixVente: number;
  coutRevient: number;
  actif: boolean;
  /** Tarif de gros accordé aux livreurs (stocké localement en complément du tarif caisse). */
  prixLivreur?: number;
}

export interface ProduitRequest {
  nom: string;
  prixVente: number;
  coutRevient: number | null;
  actif: boolean;
}

const STORAGE_PRIX_LIVREUR_KEY = 'mybread_prix_livreur_v1';

export function chargerMapPrixLivreur(): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_PRIX_LIVREUR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function obtenirPrixLivreur(produitId: number, prixCaisse: number): number {
  const map = chargerMapPrixLivreur();
  if (map[produitId] !== undefined && map[produitId] >= 0) {
    return map[produitId];
  }
  return prixCaisse;
}

export function enregistrerPrixLivreur(produitId: number, prixLivreur: number): void {
  try {
    const map = chargerMapPrixLivreur();
    map[produitId] = Math.max(0, Math.round(prixLivreur));
    localStorage.setItem(STORAGE_PRIX_LIVREUR_KEY, JSON.stringify(map));
  } catch {}
}
