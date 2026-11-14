/** URL de base de l'API Spring Boot. Le backend autorise l'origine http://localhost:4200 (CORS). */
export const API_URL = 'http://localhost:8080/api';

/** URL racine du serveur backend pour accéder aux images stockées dans /uploads/... */
export const BACKEND_BASE_URL = 'http://localhost:8080';

/**
 * Transforme une URL relative stockée en base de données (ex. "/uploads/profil-1-a1b2c3d4.jpg")
 * en URL complète vers le serveur backend ("http://localhost:8080/uploads/profil-1-a1b2c3d4.jpg").
 */
export function resoudreUrlPhoto(photoProfil?: string | null): string | null {
  if (!photoProfil || !photoProfil.trim()) {
    return null;
  }
  const p = photoProfil.trim();
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
    return p;
  }
  if (p.startsWith('/')) {
    return `${BACKEND_BASE_URL}${p}`;
  }
  return `${BACKEND_BASE_URL}/${p}`;
}

