import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopologyStore } from '../../store/topology.store';
import { UIEdge, UINode } from '../../models/topology.model';
import { NodeBoxComponent } from '../node-box/node-box.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, NodeBoxComponent, IconComponent],
  template: `
    <div 
      class="relative w-full h-full overflow-hidden bg-[#060a13] select-none"
      (mousedown)="onCanvasMouseDown($event)"
      (mousemove)="onCanvasMouseMove($event)"
      (mouseup)="onCanvasMouseUp($event)"
      (mouseleave)="onCanvasMouseUp($event)"
      (wheel)="onCanvasWheel($event)"
    >
      <!-- Controls overlay inside canvas -->
      <div class="absolute bottom-6 left-6 z-30 flex items-center gap-2 p-1.5 glass-panel rounded-xl border border-slate-200/5 select-none">
        <button 
          (click)="zoomIn()" 
          title="Zoom In"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <app-icon name="zoom-in" [size]="16"></app-icon>
        </button>
        <button 
          (click)="zoomOut()" 
          title="Zoom Out"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <app-icon name="zoom-out" [size]="16"></app-icon>
        </button>
        <div class="h-4 w-px bg-slate-800"></div>
        <button 
          (click)="resetView()" 
          title="Recenter View"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <app-icon name="maximize" [size]="16"></app-icon>
        </button>
        <span class="text-xs font-mono font-medium text-slate-500 px-2 min-w-[50px] text-center select-none">
          {{ zoomPercent() }}%
        </span>
      </div>

      <!-- Infinite Canvas Grid and SVG Workspace -->
      <svg 
        class="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- SVG Definitions for Markers/Arrows -->
        <defs>
          <marker 
            id="arrow-sync" 
            viewBox="0 0 10 10" 
            refX="9" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
          </marker>
          <marker 
            id="arrow-async" 
            viewBox="0 0 10 10" 
            refX="9" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
          </marker>
          <marker 
            id="arrow-db" 
            viewBox="0 0 10 10" 
            refX="9" 
            refY="5" 
            markerWidth="5" 
            markerHeight="5" 
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
          </marker>
        </defs>

        <!-- Transformation Layer -->
        <g [attr.transform]="transformString()">
          
          <!-- Background Grid Pattern -->
          <rect 
            x="-10000" 
            y="-10000" 
            width="20000" 
            height="20000" 
            fill="none" 
            class="canvas-grid pointer-events-none" 
          />

          <!-- 1. Containers Render Layer (drawn first) -->
          @for (node of containerNodes(); track node.id) {
            <svg:foreignObject 
              [attr.x]="node.x" 
              [attr.y]="node.y" 
              [attr.width]="node.width" 
              [attr.height]="node.height"
              class="overflow-visible transition-all duration-300"
            >
              <app-node-box [node]="node"></app-node-box>
            </svg:foreignObject>
          }

          <!-- 2. Edges Render Layer (drawn second, on top of container backdrops) -->
          @for (edge of edges(); track edge.fromNodeId + '-' + edge.toNodeId + '-' + edge.fromPort) {
            <path 
              [attr.d]="computePath(edge)" 
              fill="none" 
              [ngStyle]="edge.css"
              [class.edge-flow]="edge.type === 'async' || edge.type === 'db_flow'"
              [class.edge-pulse]="edge.isReanchored"
              [attr.marker-end]="getMarker(edge)"
              class="transition-all duration-300 stroke-[2] hover:stroke-[3] cursor-pointer"
            />
          }

          <!-- 3. Leaf Components Render Layer (drawn last, on top of edges) -->
          @for (node of leafNodes(); track node.id) {
            <svg:foreignObject 
              [attr.x]="node.x" 
              [attr.y]="node.y" 
              [attr.width]="node.width" 
              [attr.height]="node.height"
              class="overflow-visible transition-all duration-300"
            >
              <app-node-box [node]="node"></app-node-box>
            </svg:foreignObject>
          }
        </g>
      </svg>
    </div>
  `,
})
export class CanvasComponent {
  store = inject(TopologyStore);

  // Layout calculations: separate containers (non-leaves) sorted by depth
  containerNodes = computed(() => {
    const nodeMap = this.store.layoutNodes();
    return Object.values(nodeMap)
      .filter((n) => n.isVisible && !n.isLeaf)
      .sort((a, b) => a.depth - b.depth);
  });

  // Layout calculations: separate leaf nodes (components with no children)
  leafNodes = computed(() => {
    const nodeMap = this.store.layoutNodes();
    return Object.values(nodeMap)
      .filter((n) => n.isVisible && n.isLeaf);
  });

  edges = computed(() => this.store.layoutEdges());

  // Local pan & zoom coordinates signals
  panX = computed(() => this.store.panX());
  panY = computed(() => this.store.panY());
  zoom = computed(() => this.store.zoom());

  transformString = computed(() => {
    return `translate(${this.panX()}, ${this.panY()}) scale(${this.zoom()})`;
  });

  zoomPercent = computed(() => Math.round(this.zoom() * 100));

  // Panning interaction state variables
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };

  // Compute curved SVG cubic bezier paths for connectors
  computePath(edge: UIEdge): string {
    const { fromX, fromY, toX, toY } = edge;
    const dx = Math.abs(toX - fromX);
    
    // Smooth bezier curve based on distance
    const curvature = Math.max(dx * 0.45, 40);
    
    // Draw Bezier from source to target
    return `M ${fromX} ${fromY} C ${fromX + curvature} ${fromY}, ${toX - curvature} ${toY}, ${toX} ${toY}`;
  }

  getMarker(edge: UIEdge): string {
    if (edge.type === 'sync') return 'url(#arrow-sync)';
    if (edge.type === 'async') return 'url(#arrow-async)';
    if (edge.type === 'db_flow') return 'url(#arrow-db)';
    return 'url(#arrow-sync)';
  }

  // Panning Event Listeners
  onCanvasMouseDown(event: MouseEvent) {
    // Only drag on left click and when not clicking an interactive button
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest('button') || target.closest('.glass-card')) return;

    this.isDragging = true;
    this.dragStart = {
      x: event.clientX - this.panX(),
      y: event.clientY - this.panY()
    };
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    
    const nextPanX = event.clientX - this.dragStart.x;
    const nextPanY = event.clientY - this.dragStart.y;
    
    this.store.updateViewport(nextPanX, nextPanY, this.zoom());
  }

  onCanvasMouseUp(event: MouseEvent) {
    this.isDragging = false;
  }

  // Zooming via Scroll Wheel with Cursor Centering
  onCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomFactor = 0.08;
    const currentZoom = this.zoom();
    
    // Compute new zoom scale clamped between 0.15 and 2.5
    const nextZoom = Math.min(Math.max(currentZoom - event.deltaY * zoomFactor * 0.01, 0.15), 2.5);
    
    // Cursor Centering Zoom Math:
    // Translates the viewport so the position of the cursor remains anchored in graph coordinate space.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const graphMouseX = (mouseX - this.panX()) / currentZoom;
    const graphMouseY = (mouseY - this.panY()) / currentZoom;

    const nextPanX = mouseX - graphMouseX * nextZoom;
    const nextPanY = mouseY - graphMouseY * nextZoom;

    this.store.updateViewport(nextPanX, nextPanY, nextZoom);
  }

  // Viewport Control Actions
  zoomIn() {
    const nextZoom = Math.min(this.zoom() + 0.15, 2.5);
    this.store.updateViewport(this.panX(), this.panY(), nextZoom);
  }

  zoomOut() {
    const nextZoom = Math.max(this.zoom() - 0.15, 0.15);
    this.store.updateViewport(this.panX(), this.panY(), nextZoom);
  }

  resetView() {
    this.store.resetViewport();
  }
}
