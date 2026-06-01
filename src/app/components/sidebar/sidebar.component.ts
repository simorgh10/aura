import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TopologyStore } from '../../store/topology.store';
import { IconComponent } from '../icon/icon.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <!-- Overlay Backdrop -->
    <div 
      *ngIf="selectedNode()"
      (click)="close()"
      class="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-300"
    ></div>

    <!-- Slide-over Pane -->
    <div 
      [ngClass]="selectedNode() ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'"
      class="absolute top-0 right-0 h-full w-[440px] z-50 glass-panel border-l border-slate-200/5 shadow-2xl flex flex-col drawer-transition select-none"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-950/20 select-none">
        <div class="flex items-center gap-3">
          <div 
            [class]="typeConfig()?.badge_css || 'bg-slate-800/40 border-slate-700/30 text-slate-300'"
            class="flex items-center justify-center p-2 rounded-xl border"
          >
            <app-icon [name]="iconName()" [size]="18"></app-icon>
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-100 tracking-tight leading-none">
              {{ selectedNode()?.name }}
            </h2>
            <span class="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mt-1 block">
              {{ selectedNode()?.type }} Entity Description
            </span>
          </div>
        </div>

        <button 
          (click)="close()"
          class="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <app-icon name="close" [size]="16"></app-icon>
        </button>
      </div>

      <!-- Scrollable Documentation Content -->
      <div class="flex-1 overflow-y-auto px-6 py-6 select-text">
        @if (loadingDoc()) {
          <div class="h-40 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div class="w-8 h-8 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin"></div>
            <span class="text-xs">Loading specifications...</span>
          </div>
        } @else if (docHtml()) {
          <article [innerHTML]="docHtml()" class="prose prose-invert max-w-none text-slate-300"></article>
        } @else {
          <!-- Fallback if no doc linked -->
          <div class="text-center py-12 px-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20 my-auto select-none">
            <app-icon name="archive" [size]="32" class="text-slate-600 mx-auto mb-3.5"></app-icon>
            <h3 class="text-sm font-semibold text-slate-300 mb-1">No Specifications Provided</h3>
            <p class="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
              This entity does not have an attached markdown file. Configure 'docs' in your Topology manifest.
            </p>
          </div>
        }
      </div>

      <!-- Links Footer -->
      @if (selectedNode()?.links && selectedNode()!.links!.length > 0) {
        <div class="px-6 py-4 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between select-none">
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Repository & Docs
          </span>
          <div class="flex items-center gap-3">
            @for (link of selectedNode()?.links; track link.url) {
              <a 
                [href]="link.url" 
                target="_blank" 
                class="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors bg-slate-800/40 border border-slate-700/30 px-3 py-1.5 rounded-lg"
              >
                <app-icon [name]="link.type" [size]="14"></app-icon>
                <span class="capitalize">{{ link.type }}</span>
              </a>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SidebarComponent {
  private store = inject(TopologyStore);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  readonly typeConfig = computed(() => {
    const node = this.selectedNode();
    if (!node) return null;
    return this.store.manifest()?.types.components[node.type] || null;
  });

  selectedNode = computed(() => {
    const id = this.store.selectedComponentId();
    if (!id) return null;
    return this.store.layoutNodes()[id] || null;
  });

  iconName = computed(() => {
    const node = this.selectedNode();
    if (!node) return 'cpu';
    const manifest = this.store.manifest();
    if (manifest && manifest.types.components[node.type]) {
      return manifest.types.components[node.type].icon;
    }
    return 'cpu';
  });

  loadingDoc = signal(false);
  docHtml = signal<SafeHtml | null>(null);

  constructor() {
    // Reactive Watcher: triggers fetching documentation when the selectedNode changes
    effect(() => {
      const node = this.selectedNode();
      if (!node) {
        this.docHtml.set(null);
        return;
      }

      if (node.docs) {
        this.loadingDoc.set(true);
        this.http.get(node.docs, { responseType: 'text' }).subscribe({
          next: (markdown) => {
            const rawHtml = this.renderMarkdown(markdown);
            this.docHtml.set(this.sanitizer.bypassSecurityTrustHtml(rawHtml));
            this.loadingDoc.set(false);
          },
          error: (err) => {
            console.error('Failed to load markdown documentation', err);
            this.docHtml.set(null);
            this.loadingDoc.set(false);
          }
        });
      } else {
        this.docHtml.set(null);
      }
    });
  }

  close() {
    this.store.setSelectedComponent(null);
  }

  // Pure TypeScript Markdown to HTML Renderer with Alerts support
  private renderMarkdown(markdown: string): string {
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;
    let inCode = false;
    let codeBlockContent = '';

    for (let line of lines) {
      const trimmed = line.trim();

      // Code blocks
      if (trimmed.startsWith('```')) {
        if (inCode) {
          inCode = false;
          html += `<pre class="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 font-mono text-[11px] text-cyan-400 overflow-x-auto my-3 select-text"><code>${codeBlockContent}</code></pre>`;
          codeBlockContent = '';
        } else {
          inCode = true;
        }
        continue;
      }

      if (inCode) {
        codeBlockContent += line + '\n';
        continue;
      }

      // Lists
      if (trimmed.startsWith('- ')) {
        if (!inList) {
          inList = true;
          html += '<ul class="list-disc pl-5 my-3.5 space-y-1.5 text-xs text-slate-300 select-text">';
        }
        html += `<li>${this.parseInlineMarkdown(trimmed.substring(2))}</li>`;
        continue;
      } else {
        if (inList) {
          inList = false;
          html += '</ul>';
        }
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        html += `<h1 class="text-xl font-bold font-title text-slate-100 mt-5 mb-2.5 border-b border-slate-800/60 pb-2 select-text">${this.parseInlineMarkdown(trimmed.substring(2))}</h1>`;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        html += `<h2 class="text-base font-semibold font-title text-slate-200 mt-4.5 mb-2 select-text">${this.parseInlineMarkdown(trimmed.substring(3))}</h2>`;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        html += `<h3 class="text-sm font-semibold font-title text-slate-300 mt-4 mb-1.5 select-text">${this.parseInlineMarkdown(trimmed.substring(4))}</h3>`;
        continue;
      }

      // Blockquotes & Alerts (e.g. > [!NOTE], > [!WARNING], > [!CAUTION])
      if (trimmed.startsWith('> ') || trimmed.startsWith('&gt; ')) {
        const rawQuote = trimmed.startsWith('&gt; ') ? trimmed.substring(5).trim() : trimmed.substring(2).trim();
        
        if (rawQuote.startsWith('[!NOTE]')) {
          html += `
            <div class="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-r-xl my-4 select-text">
              <div class="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>Note
              </div>
              <p class="text-slate-300 text-xs leading-relaxed">${this.parseInlineMarkdown(rawQuote.substring(7).trim())}</p>
            </div>`;
        } else if (rawQuote.startsWith('[!WARNING]')) {
          html += `
            <div class="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-xl my-4 select-text">
              <div class="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>Warning
              </div>
              <p class="text-slate-300 text-xs leading-relaxed">${this.parseInlineMarkdown(rawQuote.substring(10).trim())}</p>
            </div>`;
        } else if (rawQuote.startsWith('[!CAUTION]')) {
          html += `
            <div class="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl my-4 select-text">
              <div class="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>Caution
              </div>
              <p class="text-slate-300 text-xs leading-relaxed">${this.parseInlineMarkdown(rawQuote.substring(10).trim())}</p>
            </div>`;
        } else {
          html += `<blockquote class="border-l-4 border-slate-700 pl-4 py-1 italic my-4 text-slate-400 text-xs leading-relaxed select-text">${this.parseInlineMarkdown(rawQuote)}</blockquote>`;
        }
        continue;
      }

      // Horizontal Rule
      if (trimmed === '---') {
        html += '<hr class="border-slate-800 my-5">';
        continue;
      }

      // Blank line
      if (!trimmed) {
        continue;
      }

      // Paragraph
      html += `<p class="text-slate-300 text-xs leading-relaxed my-2.5 select-text">${this.parseInlineMarkdown(trimmed)}</p>`;
    }

    if (inList) {
      html += '</ul>';
    }

    return html;
  }

  private parseInlineMarkdown(text: string): string {
    return text
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Inline Code
      .replace(/`([^`]+)`/g, '<code class="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-[10px] border border-slate-800">$1</code>');
  }
}
