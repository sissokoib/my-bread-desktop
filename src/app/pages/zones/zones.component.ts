import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ZoneDialogComponent } from '../../dialogs/zone-dialog.component';
import { Client } from '../../models/client.model';
import { Zone } from '../../models/zone.model';
import { ClientService } from '../../services/client.service';
import { messageErreur } from '../../services/message-erreur';
import { ZoneService } from '../../services/zone.service';

@Component({
  selector: 'app-zones',
  imports: [FormsModule, ZoneDialogComponent],
  templateUrl: './zones.component.html',
  styleUrl: './zones.component.css',
})
export class ZonesComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);
  private readonly clientService = inject(ClientService);

  protected readonly zones = signal<Zone[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly recherche = signal('');
  protected readonly erreur = signal<string | null>(null);

  protected readonly dialogOuvert = signal(false);
  protected readonly zoneSelectionnee = signal<Zone | null>(null);

  protected readonly compteurClients = computed(() => {
    const map = new Map<number, number>();
    for (const c of this.clients()) {
      if (c.zoneId !== null) {
        map.set(c.zoneId, (map.get(c.zoneId) ?? 0) + 1);
      }
    }
    return map;
  });

  protected readonly zonesFiltrees = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    return this.zones().filter((z) => !q || z.nom.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.charger();
  }

  protected ouvrirCreation(): void {
    this.zoneSelectionnee.set(null);
    this.dialogOuvert.set(true);
  }

  protected ouvrirEdition(zone: Zone): void {
    this.zoneSelectionnee.set(zone);
    this.dialogOuvert.set(true);
  }

  protected apresEnregistrement(): void {
    this.dialogOuvert.set(false);
    this.charger();
  }

  private charger(): void {
    forkJoin({
      zones: this.zoneService.lister(),
      clients: this.clientService.lister(),
    }).subscribe({
      next: ({ zones, clients }) => {
        this.zones.set(zones);
        this.clients.set(clients);
        this.erreur.set(null);
      },
      error: (err) => this.erreur.set(messageErreur(err)),
    });
  }
}

