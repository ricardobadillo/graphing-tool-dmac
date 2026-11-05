import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  SECTION_META,
  toolsForSection,
  type SectionKey,
  type SectionMeta,
  type ToolDefinition,
} from './tools';

interface SectionContent extends SectionMeta {
  tools: ToolDefinition[];
}

@Component({
  selector: 'app-section-hub',
  imports: [RouterLink],
  templateUrl: './section-hub.html',
  styleUrl: './section-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHub {
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  readonly section = computed<SectionKey>(() =>
    this.routeData()['section'] === 'programming' ? 'programming' : 'math',
  );

  readonly content = computed<SectionContent>(() => ({
    ...SECTION_META[this.section()],
    tools: toolsForSection(this.section()),
  }));
}
