import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopologyStore } from './store/topology.store';
import { CanvasComponent } from './components/canvas/canvas.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { IconComponent } from './components/icon/icon.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    CanvasComponent, 
    SidebarComponent, 
    IconComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class App implements OnInit {
  // Inject global Topology NgRx SignalStore
  readonly store = inject(TopologyStore);

  // Expanded/Collapsed state for left filters panel
  readonly leftSidebarExpanded = signal(true);

  // Computes the architectural layers list defined in the active hierarchy
  readonly layers = computed(() => {
    const activeHierarchy = this.store.activeHierarchy();
    if (!activeHierarchy) return [];
    return activeHierarchy.layers;
  });

  ngOnInit() {
    // Automatically load topological YAML manifest on init
    this.store.loadTopology();
  }
}
