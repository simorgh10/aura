import { Component, input, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UINode } from '../../models/topology.model';
import { TopologyStore } from '../../store/topology.store';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-node-box',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div 
      [ngClass]="{
        'border-blue-500/20 shadow-blue-900/10': node().type === 'domain' || node().type === 'schema',
        'border-cyan-500/25': node().type === 'microservice' || node().type === 'springboot' || node().type === 'connector',
        'border-emerald-500/25': node().type === 'database' || node().type === 'aurora' || node().type === 'opensearch',
        'border-purple-500/25': node().type === 'subnet' || node().type === 'kafka',
        'border-amber-500/25': node().type === 'bucket' || node().type === 'folder',
        'border-pink-500/25': node().type === 'gateway' || node().type === 'lambda' || node().type === 'table',
        'ring-2 ring-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.35)]': isSelected(),
        'cursor-grabbing ring-1 ring-cyan-500/50 scale-[1.01] shadow-2xl z-30 bg-slate-900/45': isDragging(),
        'cursor-grab': !isDragging()
      }"
      [ngStyle]="node().css"
      (mousedown)="onMouseDown($event)"
      (click)="selectNode($event)"
      class="w-full h-full glass-card rounded-xl border flex flex-col overflow-hidden select-none relative"
    >
      <!-- Header Area -->
      <div 
        [class.border-b]="node().isLeaf || !node().isExpanded"
        class="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/35 border-slate-200/5 select-none"
      >
        <div class="flex items-center gap-2 max-w-[80%]">
          <div 
            [ngClass]="{
              'text-blue-400': node().type === 'domain' || node().type === 'schema',
              'text-cyan-400': node().type === 'microservice' || node().type === 'springboot' || node().type === 'connector',
              'text-emerald-400': node().type === 'database' || node().type === 'aurora' || node().type === 'opensearch',
              'text-purple-400': node().type === 'subnet' || node().type === 'kafka',
              'text-amber-400': node().type === 'bucket' || node().type === 'folder',
              'text-pink-400': node().type === 'gateway' || node().type === 'lambda' || node().type === 'table'
            }"
            class="flex items-center justify-center p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30"
          >
            <app-icon [name]="iconName()" [size]="15"></app-icon>
          </div>
          <span class="font-semibold text-sm text-slate-100 font-sans tracking-tight truncate">
            {{ node().name }}
          </span>
        </div>

        <!-- Expansion Toggle (for domains/containers) -->
        @if (!node().isLeaf && node().childrenIds.length > 0) {
          <button 
            (click)="toggleExpand($event)"
            (mousedown)="$event.stopPropagation()"
            class="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <app-icon 
              [name]="node().isExpanded ? 'chevron-down' : 'chevron-right'" 
              [size]="16"
            ></app-icon>
          </button>
        }
      </div>

      <!-- Body / Container Placeholder (renders when expanded) -->
      @if (!node().isLeaf && node().isExpanded) {
        <div class="flex-1 flex flex-col px-4 pt-10 pb-4 border-t border-slate-800/50 bg-slate-950/20 select-none">
          @if (node().childrenIds.length === 0) {
            <div class="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">
              Encapsulated Entities
            </div>
            <div class="flex-1 flex gap-2 overflow-hidden border border-dashed border-slate-800/60 rounded-lg bg-slate-950/40 p-2.5 relative">
              <span class="text-xs text-slate-500 italic m-auto pointer-events-none select-none">
                Recursive container grid layout
              </span>
            </div>
          }
        </div>
      } @else {
        <div class="flex-1 px-4 py-3 flex flex-col justify-between select-none">
          <span class="text-[11px] text-slate-400 leading-normal font-sans line-clamp-2" [title]="node().description || ''">
            {{ node().description || (node().type | uppercase) + ' Component node connected via port interfaces. Click to view documentation.' }}
          </span>
        </div>
      }

      <!-- Footer Area with Links -->
      @if (node().links && node().links!.length > 0 && (node().isLeaf || !node().isExpanded)) {
        <div class="px-3.5 py-2 bg-slate-950/30 border-t border-slate-200/5 flex items-center justify-end gap-2.5 select-none">
          @for (link of node().links; track link.url) {
            <a 
              [href]="link.url" 
              target="_blank" 
              (click)="$event.stopPropagation()"
              (mousedown)="$event.stopPropagation()"
              class="text-slate-400 hover:text-cyan-400 transition-colors duration-200 flex items-center"
              [title]="link.type | uppercase"
            >
              <app-icon [name]="link.type" [size]="14"></app-icon>
            </a>
          }
        </div>
      }

      <!-- Reactive Ports Dots -->
      @if (node().isLeaf || !node().isExpanded) {
        @for (port of node().ports; track port) {
          <div 
            [ngClass]="{
              '-left-[5px] top-1/2 -translate-y-1/2': port === 'in',
              '-right-[5px] top-1/2 -translate-y-1/2': port === 'out',
              '-bottom-[5px] left-1/2 -translate-x-1/2': port === 'db' || port === 'db_write',
              '-top-[5px] left-1/2 -translate-x-1/2': port === 'db_read'
            }"
            [title]="port | uppercase"
            class="absolute port-dot z-20"
          ></div>
        }
      }
    </div>
  `,
})
export class NodeBoxComponent {
  node = input.required<UINode>();
  
  private store = inject(TopologyStore);
  
  isSelected = computed(() => this.store.selectedComponentId() === this.node().id);
  isDragging = signal(false);
  private dragged = false;

  iconName = computed(() => {
    const type = this.node().type;
    const manifest = this.store.manifest();
    if (manifest && manifest.types.components[type]) {
      return manifest.types.components[type].icon;
    }
    
    // Fallbacks
    switch (type) {
      case 'domain': return 'layout';
      case 'microservice': return 'cpu';
      case 'database': return 'database';
      case 'bucket': return 'archive';
      case 'gateway': return 'globe';
      default: return 'cpu';
    }
  });

  toggleExpand(event: MouseEvent) {
    event.stopPropagation();
    this.store.toggleNodeExpanded(this.node().id);
  }

  selectNode(event: MouseEvent) {
    event.stopPropagation();
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.store.setSelectedComponent(this.node().id);
  }

  onMouseDown(event: MouseEvent) {
    // Only drag with left mouse button
    if (event.button !== 0) return;
    
    // Don't drag if clicking buttons, links, or ports
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.port-dot')) return;

    event.stopPropagation();
    
    let startX = event.clientX;
    let startY = event.clientY;
    const activeHierarchyId = this.store.activeHierarchyId();
    if (!activeHierarchyId) return;

    this.isDragging.set(true);
    this.dragged = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const zoom = this.store.zoom();
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        this.dragged = true;
      }
      
      this.store.updateNodeOffset(activeHierarchyId, this.node().id, dx, dy);
      
      startX = moveEvent.clientX;
      startY = moveEvent.clientY;
    };

    const onMouseUp = () => {
      this.isDragging.set(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}
