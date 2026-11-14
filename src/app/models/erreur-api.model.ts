/** Corps d'erreur renvoyé par le backend. */
export interface ErreurApi {
  statut: number;
  message: string;
  erreurs?: Record<string, string> | null;
}

