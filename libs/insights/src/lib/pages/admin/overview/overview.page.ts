import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AdminInsightsService } from '../../../services/admin-insights.service';

@Component({
  selector: 'app-insights-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, RouterLink],
  templateUrl: './overview.page.html',
  styleUrl: '../admin.shared.scss',
})
export class OverviewPage {
  private readonly data = inject(AdminInsightsService);
  readonly error = this.data.error;
  readonly summary = this.data.summary;
  readonly latest = this.data.latestRepairs;
  readonly totalRepairs = this.data.totalRepairs;
  readonly needsReply = this.data.needsReply;

  constructor() {
    void this.data.load();
  }

  count(status: string): number {
    return this.data.statuses().find((s) => s.status === status)?.repairCount ?? 0;
  }
}
