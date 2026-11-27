import {
  Component,
  ChangeDetectorRef,
  NgZone,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

import {
  AccountsAuthService,
  authMessage,
  accountLoginDestination,
} from '../../services/accounts-auth';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
  ],
})
export class VerifyEmailPage implements OnDestroy {
  private router = inject(Router);
  private auth = inject(AccountsAuthService);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);
  private generation = 0;
  private active = false;
  private completed = false;
  private requestPending = false;
  private deadline?: ReturnType<typeof setTimeout>;
  private cancelWait?: () => void;
  private expiresAt = 0;
  private resendAt = 0;
  private readonly onResume = () => {
    if (document.visibilityState === 'visible') this.zone.run(() => this.tick());
  };

  @ViewChildren('box')
  boxes!: QueryList<ElementRef<HTMLInputElement>>;

  purpose: 'signup' | 'reset' = 'reset';
  email = '';
  digits = ['', '', '', '', '', ''];

  busy = false;
  error = '';
  notice = '';

  remaining = 600;
  resendWait = 60;

  private sentAt = Date.now();
  private timer?: ReturnType<typeof setInterval>;

  get maskedEmail(): string {
    const [name, domain] = this.email.split('@');

    return name && domain
      ? name[0] +
        '*'.repeat(Math.max(1, name.length - 1)) +
        '@' +
        domain
      : 'your email';
  }

  get timeLeft(): string {
    const minutes =
      Math.floor(this.remaining / 60);

    const seconds =
      String(this.remaining % 60).padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  ionViewWillEnter() {
    this.stopTimer();
    this.active = true;
    const previousEmail = this.email;
    const previousPurpose = this.purpose;

    this.email = history.state?.email ?? '';
    this.purpose = history.state?.purpose === 'signup' ? 'signup' : 'reset';

    if (
      !this.email ||
      !['signup', 'reset'].includes(history.state?.purpose)
    ) {
      void this.router.navigate(
        ['/accounts-forgot-password'],
        { replaceUrl: true }
      );

      return;
    }

    const sameChallenge = this.email === previousEmail && this.purpose === previousPurpose && this.expiresAt > 0
      && this.sentAt === Number(history.state?.sentAt);
    this.sentAt = Number(history.state?.sentAt) || Date.now();
    this.expiresAt = Number(history.state?.expiresAt) || this.sentAt + 600000;
    this.resendAt = Number(history.state?.resendAt) || this.sentAt + 60000;
    this.saveTimes();

    this.error = '';
    this.notice = '';

    if (!sameChallenge && !this.busy) {
      this.completed = false;
      this.clearBoxes();
    }
    this.tick();

    this.timer = setInterval(
      () => this.zone.run(() => this.tick()),
      1000
    );
    window.addEventListener('focus', this.onResume);
    document.addEventListener('visibilitychange', this.onResume);
  }

  private saveTimes() {
    history.replaceState({ ...history.state, sentAt: this.sentAt,
      expiresAt: this.expiresAt, resendAt: this.resendAt }, '');
  }

  private tick() {
    this.remaining = Math.max(0, Math.ceil((this.expiresAt - Date.now()) / 1000));
    this.resendWait = Math.max(0, Math.ceil((this.resendAt - Date.now()) / 1000));
    this.changeDetector.markForCheck();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    window.removeEventListener('focus', this.onResume);
    document.removeEventListener('visibilitychange', this.onResume);
  }

  ionViewWillLeave() {
    this.active = false;
    this.generation++;
    this.cancelWait?.();
    this.stopTimer();
  }

  ngOnDestroy() {
    this.ionViewWillLeave();
  }

  goBack() {
    if (this.busy) return;
    void this.router.navigate(
      [this.purpose === 'signup' ? '/accounts-signup' : '/accounts-forgot-password']
    );
  }

  async verify() {
    if (this.busy || this.requestPending || this.completed) return;
    this.tick();

    const code = this.digits.join('');

    this.error = '';
    this.notice = '';

    if (!/^\d{6}$/.test(code)) {
      this.error = 'Enter the complete 6-digit code.';
      return;
    }

    if (this.remaining === 0) {
      this.error = 'Code expired. Request a new code.';
      return;
    }

    this.busy = true;
    const generation = ++this.generation;
    let stage = 'Code verification';
    let verified = false;
    const current = () => this.active && generation === this.generation;

    try {
      await this.bounded(async () => {
      if (this.purpose === 'signup') {
        await this.auth.verifySignupCode(this.email, code);
        if (!current()) return;
        verified = true;
        stage = 'Opening log in';
        await this.auth.logout(); // the verified code signed the user in; they log in themselves
        if (!current()) return;
        if (!await this.router.navigate(['/accounts-login'], {
          replaceUrl: true,
          state: { accountCreated: true },
        })) {
          throw new Error('Your email was verified, but the page could not be opened. Return to Log in.');
        }
        this.completed = true;
        return;
      }
      await this.auth.verifyResetCode(
        this.email,
        code
      );
      if (!current()) return;
      verified = true;
      stage = 'Opening password reset';
      if (!await this.router.navigate(
        ['/accounts-reset-password'],
        { replaceUrl: true }
      )) throw new Error('The code was verified, but password reset could not be opened. Try again.');
      this.completed = true;
      }, () => `${stage} timed out. ${verified ? 'The code was accepted. Return to Log in or restart password recovery.' : 'The result is unknown. Wait for the request to finish before retrying.'}`);
    } catch (error) {
      if (this.active) this.error = verified
        ? `Code accepted, but verification could not finish. ${authMessage(error)} Return to Log in or restart password recovery.`
        : authMessage(error);
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  async resend() {
    this.tick();
    if (this.busy || this.requestPending || this.completed || this.resendWait > 0) return;

    this.busy = true;
    this.error = '';
    this.notice = '';
    const generation = ++this.generation;

    try {
      await this.bounded(async () => {
        if (this.purpose === 'signup') await this.auth.resendSignupCode(this.email);
        else await this.auth.sendResetCode(this.email);
      }, () => 'Resend timed out. The result is unknown. Wait for the request to finish before retrying.');
      if (!this.active || generation !== this.generation) return;

      this.sentAt = Date.now();
      this.expiresAt = this.sentAt + 600000;
      this.resendAt = this.sentAt + 60000;
      this.saveTimes();

      history.replaceState(
        {
          ...history.state,
          sentAt: this.sentAt,
        },
        ''
      );

      this.tick();
      this.clearBoxes();

      this.notice =
        'If this email is registered and eligible, a new code has been sent. Check your inbox and spam folder.';
    } catch (error) {
      if (this.active) this.error = authMessage(error);
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  private async bounded(operation: () => Promise<void>, message: () => string) {
    this.requestPending = true;
    const request = operation().finally(() => {
      this.requestPending = false;
      this.changeDetector.markForCheck();
    });
    try {
      await Promise.race([request, new Promise<never>((_, reject) => {
        this.cancelWait = () => reject(new Error('Verification screen closed.'));
        this.deadline = setTimeout(() => {
          this.generation++;
          reject(new Error(message()));
        }, 20000);
      })]);
    } finally {
      clearTimeout(this.deadline);
      this.cancelWait = undefined;
    }
  }

  onDigitInput(event: Event, index: number) {
    if (this.busy) return;
    this.error = '';

    const box =
      event.target as HTMLInputElement;

    const typed =
      box.value.replace(/\D/g, '');

    if (typed.length > 2) {
      this.fillDigits(index, typed);
      return;
    }

    this.digits[index] = typed.slice(-1);
    box.value = this.digits[index];

    if (typed) this.focusBox(index + 1);
  }

  onDigitKeydown(
    event: KeyboardEvent,
    index: number
  ) {
    if (this.busy) { event.preventDefault(); return; }
    if (
      event.key === 'Backspace' &&
      !this.digits[index] &&
      index > 0
    ) {
      event.preventDefault();

      this.digits[index - 1] = '';

      this.boxes
        .get(index - 1)!
        .nativeElement.value = '';

      this.focusBox(index - 1);
    } else if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight'
    ) {
      event.preventDefault();

      this.focusBox(
        index +
        (event.key === 'ArrowLeft' ? -1 : 1)
      );
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    if (this.busy) return;
    this.error = '';

    const numbers = (
      event.clipboardData?.getData('text') ?? ''
    )
      .replace(/\D/g, '')
      .slice(0, 6);

    this.fillDigits(0, numbers);
  }

  private fillDigits(
    start: number,
    numbers: string
  ) {
    for (
      let i = 0;
      i < numbers.length && start + i < 6;
      i++
    ) {
      this.digits[start + i] = numbers[i];

      const box = this.boxes.get(start + i);

      if (box) {
        box.nativeElement.value = numbers[i];
      }
    }

    this.focusBox(
      Math.min(5, start + numbers.length)
    );
  }

  private clearBoxes() {
    this.digits = ['', '', '', '', '', ''];

    this.boxes?.forEach(
      box => box.nativeElement.value = ''
    );

    this.focusBox(0);
  }

  private focusBox(index: number) {
    this.boxes
      ?.get(index)
      ?.nativeElement.focus();
  }
}
