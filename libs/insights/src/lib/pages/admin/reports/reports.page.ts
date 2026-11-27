import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminInsightsService } from '../../../services/admin-insights.service';

@Component({
  selector: 'app-insights-reports-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './reports.page.html',
  styleUrl: '../admin.shared.scss',
})
export class ReportsPage {
  private readonly data = inject(AdminInsightsService);
  readonly error = this.data.error;
  readonly summary = this.data.summary;
  readonly statuses = this.data.statuses;
  readonly technicians = this.data.technicians;
  readonly totalRepairs = this.data.totalRepairs;

  readonly statusMax = computed(() => Math.max(1, ...this.statuses().map((s) => s.repairCount)));
  readonly starRows = computed(() => {
    const s = this.summary();
    const max = Math.max(1, ...Object.values(s.stars));
    return ([5, 4, 3, 2, 1] as const).map((n) => ({ star: n, count: s.stars[n], pct: (s.stars[n] / max) * 100 }));
  });
  readonly nothingYet = computed(() => this.totalRepairs() === 0 && this.summary().totalReviews === 0);

  constructor() {
    void this.data.load();
  }
}
