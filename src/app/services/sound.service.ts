import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private audioCashRegister: HTMLAudioElement | null = null;

  constructor() {
    this.prechargerAudio();
  }

  private prechargerAudio(): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      this.audioCashRegister = new Audio('cash-register.wav');
      this.audioCashRegister.preload = 'auto';
      this.audioCashRegister.load();
    } catch {
      // Ignorer si non disponible à l'initialisation
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx && AudioCtx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Joue le véritable son physique authentique « Cash Register Sound Effect »
   * (tiroir-caisse de pharmacie / commerce : déverrouillage mécanique + glissement + cloche d'or + tintement de monnaie).
   */
  jouerSonCaisse(): void {
    // 1. Tenter la lecture prioritaire du fichier audio haute fidélité
    if (this.audioCashRegister) {
      try {
        this.audioCashRegister.currentTime = 0;
        const playPromise = this.audioCashRegister.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Repli transparent sur la synthèse acoustique en cas de blocage d'élément média
            this.jouerSonSynthetise();
          });
          return;
        }
      } catch {
        // En cas d'échec immédiat, repli sur la synthèse
      }
    }

    // 2. Repli acoustique natif Web Audio
    this.jouerSonSynthetise();
  }

  /**
   * Synthèse physique ultra-réaliste du tiroir-caisse de pharmacie
   */
  private jouerSonSynthetise(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Déclencheur mécanique & glissement tiroir
      this.bruitMecaniqueTiroir(ctx, now);

      // Cloche d'or en laiton (C7 - 2093 Hz avec battement acoustique chatoyant)
      this.sonnerCloche(ctx, now + 0.05, 2093.0, 0.75, 0.85);
      this.sonnerCloche(ctx, now + 0.05, 2097.2, 0.75, 0.55); // Battement 4.2Hz (effet shimmer)

      // Tintements successifs des pièces de monnaie dans le bac métallique
      this.tintementPiece(ctx, now + 0.09, 3950.0, 0.12, 0.20);
      this.tintementPiece(ctx, now + 0.14, 4600.0, 0.15, 0.18);
      this.tintementPiece(ctx, now + 0.19, 3400.0, 0.18, 0.16);
      this.tintementPiece(ctx, now + 0.25, 5200.0, 0.10, 0.15);
    } catch (e) {
      console.warn('Audio non disponible :', e);
    }
  }

  /**
   * Son court et agréable pour les validations de commande ou pointage simple
   */
  jouerSonSucces(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.sonnerCloche(ctx, now, 880, 0.3, 0.2); // A5
      this.sonnerCloche(ctx, now + 0.09, 1174.6, 0.5, 0.25); // D6
    } catch (e) {
      console.warn('Audio non disponible :', e);
    }
  }

  private bruitMecaniqueTiroir(ctx: AudioContext, t: number): void {
    // Petit clac mécanique de déclenchement
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.045);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private sonnerCloche(
    ctx: AudioContext,
    t: number,
    freq: number,
    duree: number,
    volume: number,
  ): void {
    // Fondamentale
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);

    gain1.gain.setValueAtTime(volume, t);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + duree);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + duree);

    // Harmonique métallique brillante
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.756, t);

    gain2.gain.setValueAtTime(volume * 0.4, t);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + duree * 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + duree * 0.6);
  }

  private tintementPiece(
    ctx: AudioContext,
    t: number,
    freq: number,
    duree: number,
    volume: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duree);
  }
}
