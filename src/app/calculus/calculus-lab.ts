import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { LHopitalLab } from './lhopital-lab';
import { Optimization1DLab } from './optimization-1d-lab';
import { IntegrationLab } from './integration-lab';
import { ApplicationsLab } from './applications-lab';
import { OdeLab } from './ode-lab';
import { PartialsLab } from './partials-lab';
import { DirectionalLab } from './directional-lab';

type TabKey =
  | 'lhopital'
  | 'optimization'
  | 'integration'
  | 'applications'
  | 'odes'
  | 'partials'
  | 'directional';

interface Tab {
  key: TabKey;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-calculus-lab',
  imports: [
    LHopitalLab,
    Optimization1DLab,
    IntegrationLab,
    ApplicationsLab,
    OdeLab,
    PartialsLab,
    DirectionalLab,
  ],
  templateUrl: './calculus-lab.html',
  styleUrl: './calculus-lab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculusLab {
  readonly tab = signal<TabKey>('lhopital');
  readonly tabs: Tab[] = [
    { key: 'lhopital', label: 'L’Hôpital', hint: '0/0 · ∞/∞' },
    { key: 'optimization', label: 'Optimización 1D', hint: 'máximos y mínimos' },
    { key: 'integration', label: 'Integración', hint: 'definida · impropia · técnicas' },
    { key: 'applications', label: 'Aplicaciones', hint: 'área · arco · volumen' },
    { key: 'odes', label: 'EDOs', hint: 'separables · lineales' },
    { key: 'partials', label: 'Parciales', hint: 'gradiente · plano tangente' },
    { key: 'directional', label: 'Direccionales', hint: 'gradiente · dirección' },
  ];

  setTab(key: TabKey): void {
    this.tab.set(key);
  }
}
