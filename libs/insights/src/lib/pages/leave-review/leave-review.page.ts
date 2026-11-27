import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { LeaveReviewService } from '../../services/leave-review.service';
import { MAX_COMMENT_LENGTH, ReviewRuleError, minutesLeft, starText } from '../../models/review.model';

@Component({
  selector: 'app-leave-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LeaveReviewService],
  imports: [IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonSpinner, IonTextarea, IonTitle, IonToolbar],
  templateUrl: './leave-review.page.html',
  styleUrl: './leave-review.page.scss',
})
export class LeaveReviewPage {
  private readonly data = inject(LeaveReviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly maxComment = MAX_COMMENT_LENGTH;
  readonly choices = [1, 2, 3, 4, 5];
  readonly stars = starText;

  readonly phase = this.data.phase;
  readonly error = this.data.error;
  readonly repair = this.data.repair;
  readonly review = this.data.review;

  readonly rating = signal(0);
  readonly comment = signal('');
  readonly editing = signal(false);
  readonly busy = signal(false);
  private readonly now = signal(Date.now());

  readonly canReview = computed(() => this.repair()?.status === 'completed');
  readonly canSend = computed(() => this.rating() >= 1 && !this.busy());
  readonly minutes = computed(() => {
    const r = this.review();
    return r ? minutesLeft(r, this.now()) : 0;
  });

  constructor() {
    const repairId = this.route.snapshot.paramMap.get('repairId') ?? '';
    void this.data.load(repairId);
  }

  onComment(event: Event): void {
    this.comment.set((event as CustomEvent<{ value?: string | null }>).detail.value ?? '');
  }

  async send(): Promise<void> {
    await this.run(async () => {
      await this.data.submit(this.rating(), this.comment());
      this.rating.set(0);
      this.comment.set('');
      this.now.set(Date.now());
    }, 'Thank you! Your review was sent.');
  }

  startEdit(): void {
    const r = this.review();
    if (!r) return;
    this.now.set(Date.now());
    this.rating.set(r.rating);
    this.comment.set(r.comment ?? '');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  async saveEdit(): Promise<void> {
    await this.run(async () => {
      await this.data.edit(this.rating(), this.comment());
      this.editing.set(false);
    }, 'Your review was updated.');
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Delete your review?',
      message: 'This permanently removes your review and any reply attached to it.',
      buttons: [
        { text: 'Keep it', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.run(async () => {
              await this.data.remove();
              this.rating.set(0);
              this.comment.set('');
            }, 'Your review was deleted.');
          },
        },
      ],
    });
    await alert.present();
  }

  private async run(action: () => Promise<void>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      await this.toast(success, 'success');
    } catch (error) {
      this.now.set(Date.now());
      this.editing.set(false);
      await this.toast(error instanceof ReviewRuleError ? error.message : 'Something went wrong. Please try again.', 'danger');
    } finally {
      this.busy.set(false);
    }
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toasts.create({ message, duration: 2600, color, position: 'top' });
    await t.present();
  }
}
