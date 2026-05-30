import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TopologyStore } from './store/topology.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App {
  // Inject global Topology NgRx SignalStore
  readonly store = inject(TopologyStore);

  // Computed helper to check if we are currently displaying a topology diagram
  readonly isLeafView = computed(() => {
    return this.store.currentViewType() === 'leaf';
  });
}
