import { Routes } from '@angular/router';
import { RootTopologyComponent } from './components/root-topology/root-topology.component';

export const routes: Routes = [
  { path: '**', component: RootTopologyComponent }
];

