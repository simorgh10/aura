import { Injectable } from '@angular/core';
import { ComponentNodeConfig } from '../models/topology.model';

@Injectable({
  providedIn: 'root',
})
export class PropertyResolverService {
  /**
   * Recursively parses standard `${key}` markers and replaces them using the active profile's `props` map.
   */
  resolveString(template: string, props: Record<string, string>): string {
    if (!template) return '';
    return template.replace(/\${([^}]+)}/g, (match, key) => {
      const trimmedKey = key.trim();
      return props[trimmedKey] !== undefined ? props[trimmedKey] : match;
    });
  }

  /**
   * Translates component properties based on active environment profile properties.
   */
  resolveNode(node: ComponentNodeConfig, props: Record<string, string>): ComponentNodeConfig {
    const resolvedLinks = node.links?.map((link) => ({
      type: this.resolveString(link.type, props),
      url: this.resolveString(link.url, props),
    }));

    return {
      ...node,
      name: this.resolveString(node.name, props),
      docs: node.docs ? this.resolveString(node.docs, props) : undefined,
      links: resolvedLinks,
    };
  }
}
