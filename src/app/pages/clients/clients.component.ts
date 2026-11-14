import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ClientDialogComponent } from '../../dialogs/client-dialog.component';
import { PrixClientDialogComponent } from '../../dialogs/prix-client-dialog.component';
import { Client } from '../../models/client.model';
import { Zone } from '../../models/zone.model';
import { ClientService } from '../../services/client.service';
import { messageErreur } from '../../services/message-erreur';
import { ZoneService } from '../../services/zone.service';

@Component({
  selector: 'app-clients',
  imports: [FormsModule, DecimalPipe, ClientDialogComponent, PrixClientDialogComponent],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.css',
})
export class ClientsComponent implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly zoneService = inject(ZoneService);

  protected readonly clients = signal<Client[]>([]);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly recherche = signal('');
  protected readonly zoneFiltre = signal<number | null>(null);
  protected readonly actifsSeulement = signal(false);
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogOuvert = signal(false);
  protected readonly clientSelectionne = signal<Client | null>(null);
  protected readonly clientTarifs = signal<Client | null>(null);

  protected readonly clientsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const zoneId = this.zoneFiltre();
    const actifs = this.actifsSeulement();
    return this.clients().filter((c) => {
      if (actifs && !c.actif) {
        return false;
      }
      if (zoneId !== null && c.zoneId !== zoneId) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        c.nomBoutique.toLowerCase().includes(q) ||
        (c.nomResponsable?.toLowerCase().includes(q) ?? false) ||
        c.telephone.includes(q)
      );
    });
  });

  ngOnInit(): void {
    this.charger();
  }

  protected ouvrirCreation(): void {
    this.clientSelectionne.set(null);
    this.dialogOuvert.set(true);
  }

  protected ouvrirEdition(client: Client): void {
    this.clientSelectionne.set(client);
    this.dialogOuvert.set(true);
  }

  protected apresEnregistrement(): void {
    this.dialogOuvert.set(false);
    this.charger();
  }

  private charger(): void {
    forkJoin({
      clients: this.clientService.lister(),
      zones: this.zoneService.lister(),
    }).subscribe({
      next: ({ clients, zones }) => {
        this.clients.set(clients);
        this.zones.set(zones);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}

