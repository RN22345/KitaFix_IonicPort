import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonLabel, IonSegment, IonSegmentButton, IonToolbar } from '@ionic/angular';
import { AdminReviewsPage } from '../reviews/reviews.page';
import { ReportsPage } from '../reports/reports.page';

type View = 'reviews' | 'reports';

/** The "Insights" tab: one page with a Reviews | Reports toggle (as in the wireframe). */
@Component({
  selector: 'app-insights-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonLabel, IonSegment, IonSegmentButton, IonToolbar, AdminReviewsPage, ReportsPage],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-segment [value]="view()" (ionChange)="onView($event)">
          <ion-segment-button value="reviews"><ion-label>Reviews</ion-label></ion-segment-button>
          <ion-segment-button value="reports"><ion-label>Reports</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      @if (view() === 'reviews') {
        <app-insights-reviews-view />
      } @else {
        <app-insights-reports-view />
      }
    </ion-content>
  `,
  styles: [':host { display: block; } ion-segment { margin: 4px 16px; }'],
})
export class InsightsPage {
  private readonly route = inject(ActivatedRoute);
  readonly view = signal<View>(this.route.snapshot.queryParamMap.get('view') === 'reports' ? 'reports' : 'reviews');

  onView(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | number }>).detail.value;
    this.view.set(value === 'reports' ? 'reports' : 'reviews');
  }
}
