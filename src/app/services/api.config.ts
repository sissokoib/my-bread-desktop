/** URL par défaut du backend hébergé en ligne (Cloud Render) */
export const CLOUD_API_URL = 'https://boulangerie-7yz6.onrender.com/api';
export const CLOUD_BASE_URL = 'https://boulangerie-7yz6.onrender.com';

/** URL locale pour le développement machine */
export const LOCAL_API_URL = 'http://localhost:8080/api';

/**
 * Détermine l'URL de l'API :
 * 1. Priorité à l'URL personnalisée en localStorage si configurée (ex: test local)
 * 2. Par défaut en production / desktop : pointe sur le backend hébergé 24h/24 sur Render
 *    ce qui permet à l'application de fonctionner même quand le backend de votre PC est éteint.
 */
function determinerApiUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const perso = window.localStorage.getItem('my_bread_api_url');
    if (perso && perso.trim()) {
      return perso.trim().replace(/\/+$/, '');
    }
  }
  return CLOUD_API_URL;
}

/** URL de base de l'API Spring Boot. */
export const API_URL = determinerApiUrl();

/** URL racine du serveur backend pour accéder aux images stockées dans /uploads/... */
export const BACKEND_BASE_URL = API_URL.replace(/\/api$/, '');

/**
 * Transforme une URL relative stockée en base de données (ex. "/uploads/profil-1-a1b2c3d4.jpg")
 * en URL complète vers le serveur backend hébergé ou local.
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

