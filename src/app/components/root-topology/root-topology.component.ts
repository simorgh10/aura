import { Component, inject, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TopologyStore } from '../../store/topology.store';
import { CanvasComponent } from '../canvas/canvas.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-root-topology',
  standalone: true,
  imports: [CommonModule, RouterModule, CanvasComponent, SidebarComponent, IconComponent],
  host: {
    class: 'block w-full h-full'
  },
  template: `
    <div class="h-full w-full relative select-none">
      
      <!-- 1. LOADING OVERLAY VIEW -->
      @if (store.currentViewType() === 'loading') {
        <div class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#060a13]">
          <div class="w-12 h-12 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin"></div>
          <span class="text-xs font-bold tracking-widest uppercase text-slate-500 font-sans">Resolving Topology Registry...</span>
        </div>
      }

      <!-- 2. ERROR OVERLAY VIEW -->
      @if (store.currentViewType() === 'error') {
        <div class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#060a13] px-6">
          <div class="glass-panel border border-red-500/20 rounded-2xl p-6 max-w-md w-full text-center flex flex-col items-center gap-4 shadow-2xl">
            <span class="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shadow-lg">
              <app-icon name="close" [size]="24"></app-icon>
            </span>
            <h2 class="text-base font-bold text-slate-100 font-title">Topological view not found</h2>
            <p class="text-xs text-slate-400 font-sans leading-relaxed">{{ store.errorMsg() }}</p>
            <button 
              (click)="goBackHome()"
              class="mt-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <app-icon name="chevron-left" [size]="14"></app-icon> Back to Home Registry
            </button>
          </div>
        </div>
      }

      <!-- 3. INDEX LANDING VIEW (Beautiful Card Selection Grid) -->
      @if (store.currentViewType() === 'index') {
        <div class="w-full h-full overflow-y-auto bg-[#060a13] px-10 py-8 flex flex-col gap-6 select-none custom-scrollbar">
          
          <!-- Breadcrumbs Trail -->
          <nav class="flex items-center gap-2 select-none">
            <button 
              (click)="navigateToSegment([])"
              class="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <app-icon name="layout" [size]="12"></app-icon> Home
            </button>
            @for (seg of breadcrumbs(); track seg.segments.join('/')) {
              <span class="text-slate-700 text-xs font-bold select-none">/</span>
              <button 
                (click)="navigateToSegment(seg.segments)"
                class="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
              >
                {{ seg.name }}
              </button>
            }
          </nav>

          <!-- Landing Title & Desc -->
          <div class="mt-2 max-w-2xl select-none">
            <h2 class="text-2xl font-black tracking-tight text-white font-title bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-300">
              {{ store.currentIndexNode()?.name }}
            </h2>
            <p class="text-xs text-slate-400 font-sans mt-2.5 leading-relaxed">
              {{ store.currentIndexNode()?.description || 'Select an architectural branch or specific visual map to explore diagrams.' }}
            </p>
          </div>

          <!-- Categories Card Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            @for (child of store.currentIndexNode()?.children; track child.id) {
              <div 
                (click)="navigateToChild(child.id)"
                class="glass-panel border border-slate-200/5 hover:border-blue-500/25 p-6 rounded-2xl cursor-pointer hover:bg-slate-800/15 hover:scale-[1.01] transition-all duration-300 shadow-xl group flex flex-col justify-between h-48 select-none"
              >
                <div>
                  <div class="flex items-center justify-between">
                    @if (child.type === 'leaf') {
                      <span class="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md flex items-center gap-1 select-none">
                        <app-icon name="layout" [size]="10"></app-icon> Leaf Map
                      </span>
                    } @else {
                      <span class="bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md flex items-center gap-1 select-none">
                        <app-icon name="menu" [size]="10"></app-icon> Sub Index
                      </span>
                    }
                  </div>
                  
                  <h3 class="text-sm font-bold text-slate-100 mt-5 group-hover:text-blue-400 transition-colors select-none font-title">
                    {{ child.name }}
                  </h3>
                  <p class="text-xs text-slate-400 font-sans mt-2 line-clamp-2 leading-relaxed select-none">
                    {{ child.description }}
                  </p>
                </div>
                
                <div class="flex items-center justify-between text-slate-500 group-hover:text-blue-400 transition-colors text-[11px] font-bold uppercase tracking-wider select-none">
                  <span>Explore branch</span>
                  <app-icon name="chevron-left" class="rotate-180 transform group-hover:translate-x-1 transition-transform" [size]="14"></app-icon>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- 4. LEAF VIEW (Full Canvas with Sidebars) -->
      @if (store.currentViewType() === 'leaf') {
        <div class="w-full h-full flex relative overflow-hidden select-none">
          
          <!-- Dynamic breadcrumbs in leaf header overlay -->
          <div class="absolute top-6 left-6 z-40 flex items-center gap-2 px-3 py-2 glass-panel border border-slate-200/5 rounded-xl text-slate-400 text-xs shadow-lg max-w-sm">
            <button (click)="goBackHome()" class="hover:text-blue-400 transition-colors font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">
              <app-icon name="layout" [size]="10"></app-icon> Home
            </button>
            <span class="text-slate-700">/</span>
            <span class="truncate text-slate-200 font-bold uppercase tracking-wider select-none">{{ activeLeafName() }}</span>
          </div>

          <!-- Floating Sidebar Expansion button -->
          <button 
            (click)="leftSidebarExpanded.set(!leftSidebarExpanded())"
            [ngClass]="leftSidebarExpanded() ? 'left-[292px]' : 'left-6'"
            class="absolute top-20 z-40 p-2.5 rounded-xl glass-panel border border-slate-200/10 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition-all duration-300 shadow-xl cursor-pointer"
            [title]="leftSidebarExpanded() ? 'Collapse Menu' : 'Expand Menu'"
          >
            <app-icon [name]="leftSidebarExpanded() ? 'chevron-left' : 'menu'" [size]="16"></app-icon>
          </button>

          <!-- Left Controls Sidebar -->
          <aside 
            [ngClass]="leftSidebarExpanded() ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[calc(100%+24px)] opacity-0 pointer-events-none'"
            class="absolute top-20 left-6 z-30 w-64 glass-panel border border-slate-200/5 rounded-2xl p-4 flex flex-col gap-5 select-none transition-all duration-300 ease-in-out shadow-2xl"
          >
            <!-- Perspective Views Picker -->
            <div class="flex flex-col gap-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">
                Perspective Views
              </div>
              <div class="flex flex-col gap-1.5">
                @for (h of store.manifest()?.hierarchies; track h.id) {
                  <button
                    (click)="store.setActiveHierarchy(h.id)"
                    [ngClass]="store.activeHierarchyId() === h.id ? 'bg-blue-600/15 border-blue-500/35 text-blue-300 shadow-[inset_0_0_12px_rgba(59,130,246,0.1)]' : 'bg-slate-900/35 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
                    class="w-full text-left px-3.5 py-2.5 rounded-xl border font-sans text-xs font-semibold tracking-wide transition-all duration-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>{{ h.name }}</span>
                    @if (store.activeHierarchyId() === h.id) {
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]"></span>
                    }
                  </button>
                }
              </div>
            </div>

            <hr class="border-slate-800/60">

            <!-- Environment Profiles Selector -->
            @if (store.activeHierarchy()?.profiles && store.activeHierarchy()!.profiles!.length > 0) {
              <div class="flex flex-col gap-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Environment Profile
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  @for (p of store.activeHierarchy()?.profiles; track p.id) {
                    <button
                      (click)="store.setActiveProfile(p.id)"
                      [ngClass]="store.activeProfileId() === p.id ? 'bg-cyan-600/15 border-cyan-500/35 text-cyan-300 shadow-[inset_0_0_12px_rgba(6,182,212,0.1)]' : 'bg-slate-900/35 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
                      class="px-2.5 py-2 rounded-xl border font-sans text-[11px] font-bold tracking-wider uppercase transition-all duration-200 text-center cursor-pointer"
                    >
                      {{ p.id }}
                    </button>
                  }
                </div>
              </div>

              <hr class="border-slate-800/60">
            }

            <!-- Layer Toggles -->
            <div class="flex flex-col gap-2.5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 select-none">
                Component Layers
              </div>
              <div class="flex flex-col gap-1.5">
                @for (layer of layers(); track layer) {
                  <div class="flex items-center justify-between bg-slate-900/25 border border-slate-800/40 rounded-xl px-3 py-2 text-xs">
                    <div class="flex items-center gap-2 select-none">
                      <span 
                        [ngClass]="{
                          'bg-blue-500/20 text-blue-400': layer === 'domain' || layer === 'schema',
                          'bg-cyan-500/20 text-cyan-400': layer === 'microservice' || layer === 'springboot' || layer === 'connector',
                          'bg-emerald-500/20 text-emerald-400': layer === 'database' || layer === 'aurora' || layer === 'opensearch',
                          'bg-purple-500/20 text-purple-400': layer === 'subnet' || layer === 'kafka',
                          'bg-amber-500/20 text-amber-400': layer === 'bucket' || layer === 'folder',
                          'bg-pink-500/20 text-pink-400': layer === 'gateway' || layer === 'lambda' || layer === 'table'
                        }"
                        class="w-2.5 h-2.5 rounded-full"
                      ></span>
                      <span class="capitalize text-slate-300 font-medium font-sans select-none">{{ layer }}</span>
                    </div>
                    <button 
                      (click)="store.toggleLayerVisibility(layer)"
                      [ngClass]="store.hiddenLayers().includes(layer) ? 'text-slate-600 hover:text-slate-400' : 'text-cyan-400 hover:text-cyan-300'"
                      class="p-1 rounded transition-colors cursor-pointer"
                      [title]="store.hiddenLayers().includes(layer) ? 'Show Layer' : 'Hide Layer'"
                    >
                      <app-icon [name]="store.hiddenLayers().includes(layer) ? 'eye-off' : 'eye'" [size]="14"></app-icon>
                    </button>
                  </div>
                }
              </div>
            </div>
          </aside>

          <!-- Main Interactive Canvas -->
          <main class="flex-1 h-full relative z-10 select-none">
            @if (store.loading()) {
              <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#060a13]">
                <div class="w-12 h-12 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin"></div>
                <span class="text-xs font-bold tracking-widest uppercase text-slate-500">Loading Topology Graph...</span>
              </div>
            }
            <app-canvas></app-canvas>
          </main>

          <!-- Right sliding doc drawer -->
          <app-sidebar class="z-40"></app-sidebar>
        </div>
      }

    </div>
  `,
})
export class RootTopologyComponent implements OnInit, OnDestroy {
  readonly store = inject(TopologyStore);
  private readonly router = inject(Router);
  private sub?: Subscription;

  // Signal for left sidebar panel visibility toggle
  readonly leftSidebarExpanded = signal(true);

  // Compile active layers based on the loaded manifest
  readonly layers = computed(() => {
    const activeHierarchy = this.store.activeHierarchy();
    return activeHierarchy ? activeHierarchy.layers : [];
  });

  // Compute active leaf topology's name
  readonly activeLeafName = computed(() => {
    const segments = this.store.currentPathSegments();
    if (segments.length === 0) return 'Architecture Map';
    // Capitalize and format the last segment for a premium label
    const raw = segments[segments.length - 1];
    return raw.replace(/-/g, ' ');
  });

  // Dynamically build a breadcrumb trail with node names
  readonly breadcrumbs = computed(() => {
    const segments = this.store.currentPathSegments();
    const registry = this.store.registry();
    if (!registry) return [];

    const trail: { name: string; segments: string[] }[] = [];
    let currentNode = registry;
    const accumulatedSegments: string[] = [];

    for (const seg of segments) {
      if (currentNode.type === 'index' && currentNode.children) {
        const child = currentNode.children.find((c: any) => c.id === seg);
        if (child) {
          accumulatedSegments.push(seg);
          trail.push({
            name: child.name,
            segments: [...accumulatedSegments]
          });
          currentNode = child;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return trail;
  });

  ngOnInit() {
    // Resolve path immediately on init
    this.resolveCurrentPath();

    // Listen to future navigation end changes
    this.sub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.resolveCurrentPath();
      });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private resolveCurrentPath() {
    const rawUrl = this.router.url;
    const segments = rawUrl.split('/').map(s => s.trim()).filter(s => s && !s.includes('?'));
    this.store.navigateToPath(segments);
  }

  navigateToChild(childId: string) {
    const segments = this.store.currentPathSegments();
    this.router.navigate([...segments, childId]);
  }

  navigateToSegment(segments: string[]) {
    this.router.navigate(segments);
  }

  goBackHome() {
    this.router.navigate([]);
  }
}
