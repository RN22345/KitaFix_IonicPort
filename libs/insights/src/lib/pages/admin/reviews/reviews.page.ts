import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonButton, IonIcon, IonLabel, IonSearchbar, IonSegment, IonSegmentButton, IonTextarea, ToastController } from '@ionic/angular';
import { AdminInsightsService } from '../../../services/admin-insights.service';
import { AdminReview } from '../../../models/admin.model';
import { ReviewRuleError, starText } from '../../../models/review.model';

@Component({
  selector: 'app-insights-reviews-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, IonLabel, IonSearchbar, IonSegment, IonSegmentButton, IonTextarea],
  templateUrl: './reviews.page.html',
  styleUrl: '../admin.shared.scss',
})
export class AdminReviewsPage {
  private readonly data = inject(AdminInsightsService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly error = this.data.error;
  readonly summary = this.data.summary;
  readonly needsReply = this.data.needsReply;
  readonly stars = starText;
  readonly search = signal('');
  readonly filter = signal('all');
  readonly drafts = signal<Record<string, string>>({});

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.data
      .reviews()
      .filter((r) => (f === 'all' ? true : r.rating === Number(f)))
      .filter((r) => !term || `${r.customerName} ${r.comment ?? ''} ${r.device} ${r.location}`.toLowerCase().includes(term));
  });

  constructor() {
    void this.data.load();
  }

  initials(name: string): string {
    return name.replace(/[^\p{L}\s]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  }

  draft(id: string): string {
    return this.drafts()[id] ?? '';
  }

  onSearch(event: Event): void {
    this.search.set((event as CustomEvent<{ value?: string | null }>).detail.value ?? '');
  }

  onFilter(event: Event): void {
    this.filter.set(String((event as CustomEvent<{ value?: string | number }>).detail.value ?? 'all'));
  }

  setDraft(id: string, event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail.value ?? '';
    this.drafts.update((d) => ({ ...d, [id]: value }));
  }

  async sendReply(review: AdminReview): Promise<void> {
    try {
      await this.data.reply(review.id, this.draft(review.id));
      this.drafts.update((d) => ({ ...d, [review.id]: '' }));
      await this.toast('Reply sent.', 'success');
    } catch (error) {
      await this.toast(this.message(error), 'danger');
    }
  }

  async confirmDelete(review: AdminReview): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Delete this review?',
      message: `${review.reviewId} by ${review.customerName}. The shop reply is deleted too. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.data.remove(review.id);
              await this.toast('Review deleted.', 'success');
            } catch (error) {
              await this.toast(this.message(error), 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private message(error: unknown): string {
    return error instanceof ReviewRuleError ? error.message : 'Something went wrong. Please try again.';
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toasts.create({ message, duration: 2400, color, position: 'top' });
    await t.present();
  }
}
