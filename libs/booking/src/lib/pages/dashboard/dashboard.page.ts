import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular';
import { BOOKING_CONFIG } from '../../data-access/config';
import { RANK_TIERS, customerRank } from '../../models/rank.model';
import { ISSUE_DEFINITIONS, IssueFlagKey, Tone, isActiveRepair } from '../../models/repair.model';
import { formatCurrency } from '../../pricing/price-estimate';
import { issueCoveredBy } from '../../pricing/service-match';
import { RepairsService } from '../../services/repairs.service';

interface ServiceCategory {
  key: IssueFlagKey;
  name: string;
  icon: string;
  tone: Tone;
  blurb: string;
  includes: string[];
  eta: string;
  price: string;
}

interface Offer {
  tag: string;
  big: string;
  title: string;
  text: string;
  when: string;
  code: string;
  tone: Tone;
  issue: IssueFlagKey | null;
}

/** EDIT THIS: the words customers read in the service pop-up. */
const CATEGORY_COPY: Record<IssueFlagKey, { name: string; blurb: string; includes: string[]; eta: string }> = {
  issue_screen: {
    name: 'Screen Repair',
    blurb: 'Cracked, flickering or unresponsive screen? We replace the display so your phone looks and feels new again.',
    includes: ['Display and touch check', 'Screen replacement', 'Final quality test'],
    eta: 'Same-day in most cases',
  },
  issue_battery: {
    name: 'Battery Repair',
    blurb: 'Draining fast, overheating or shutting down? A fresh battery brings back your all-day power.',
    includes: ['Battery health test', 'Battery replacement', 'Charging check'],
    eta: 'Usually within the hour',
  },
  issue_charging: {
    name: 'Charging Port',
    blurb: 'Loose cable or phone will not charge? We clean or replace the charging port.',
    includes: ['Port inspection and cleaning', 'Port replacement if needed', 'Charge-speed test'],
    eta: 'Usually within the day',
  },
  issue_camera: {
    name: 'Camera Repair',
    blurb: 'Blurry, black or cracked camera? We fix or replace the lens and module.',
    includes: ['Front and rear camera test', 'Lens or module replacement', 'Focus check'],
    eta: 'Confirmed after diagnosis',
  },
  issue_audio: {
    name: 'Speaker & Mic',
    blurb: 'No sound, muffled calls or a mic that will not pick you up? We get your audio crystal clear.',
    includes: ['Speaker and mic test', 'Cleaning or replacement', 'Call-quality check'],
    eta: 'Confirmed after diagnosis',
  },
  issue_software: {
    name: 'Software & OS',
    blurb: 'Boot loops, slow phone or failed updates? We reinstall and reset with your data protected.',
    includes: ['Data backup', 'OS reinstall or reset', 'Performance check'],
    eta: 'Usually within the day',
  },
};

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Home: welcome banner, service categories, special offers, customer rank and
 * how it works. History, search, cancel and reschedule live on Repairs.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnInit {
  private readonly booking = inject(RepairsService);
  private readonly router = inject(Router);
  private readonly config = inject(BOOKING_CONFIG);
  private readonly toast = inject(ToastController);

  readonly offerTrack = viewChild<ElementRef<HTMLElement>>('offerTrack');

  readonly currentUser = this.booking.currentUser;
  readonly repairs = this.booking.myRepairs;
  readonly error = this.booking.error;

  readonly name = computed(() => this.currentUser()?.full_name.split(' ')[0] ?? 'there');

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly activeCount = computed(() => this.repairs().filter((repair) => isActiveRepair(repair)).length);
  readonly completed = computed(() => this.repairs().filter((repair) => repair.status === 'completed').length);

  // ---------- services ----------
  readonly categories = computed<ServiceCategory[]>(() =>
    ISSUE_DEFINITIONS.map((issue) => {
      const copy = CATEGORY_COPY[issue.key];
      const service = this.booking.serviceOptions().find((item) => issueCoveredBy(item) === issue.key);
      return {
        key: issue.key,
        name: copy.name,
        icon: issue.icon,
        tone: issue.tone,
        blurb: copy.blurb,
        includes: copy.includes,
        eta: copy.eta,
        price: service
          ? `From ${formatCurrency(service.base_price, this.config.currency)}`
          : 'Priced after diagnosis',
      };
    }),
  );
  readonly selected = signal<ServiceCategory | null>(null);

  // ---------- special offers (EDIT THIS list with your real promos) ----------
  readonly offers: Offer[] = [
    {
      tag: 'Limited time',
      big: '15%',
      title: 'Screen Replacement Sale',
      text: 'Cracked screen? Save on any screen replacement this week.',
      when: `Ends ${inDays(6)}`,
      code: 'SCREEN15',
      tone: 'accent',
      issue: 'issue_screen',
    },
    {
      tag: 'Every Monday',
      big: 'FREE',
      title: 'Free Diagnostic Check',
      text: 'Not sure what is wrong? Bring it in on a Monday and we will check it at no cost.',
      when: 'Starts every Monday',
      code: 'FREECHECK',
      tone: 'green',
      issue: null,
    },
    {
      tag: 'Payday promo',
      big: `${this.config.currency}100`,
      title: 'Payday Battery Deal',
      text: `Get ${this.config.currency}100 off a battery replacement on the 15th and 30th.`,
      when: 'Every 15th & 30th',
      code: 'PAYDAY100',
      tone: 'orange',
      issue: 'issue_battery',
    },
    {
      tag: 'Coming soon',
      big: '2x',
      title: 'Bring-a-Friend Bonus',
      text: 'Refer a friend and you both get a discount on your next repair.',
      when: `Starts ${inDays(14)}`,
      code: 'FRIEND2X',
      tone: 'violet',
      issue: null,
    },
    {
      tag: 'Rainy season',
      big: '20%',
      title: 'Water Damage Rescue',
      text: 'Phone got wet? Get a discounted full-board cleaning and inspection.',
      when: `Until ${inDays(30)}`,
      code: 'RAINY20',
      tone: 'teal',
      issue: null,
    },
  ];
  readonly offerIndex = signal(0);

  // ---------- rank ----------
  readonly tiers = RANK_TIERS;
  readonly rank = computed(() => customerRank(this.completed()));

  // ---------- how it works ----------
  readonly steps = [
    { icon: 'construct-outline', title: 'Tell us what is wrong', text: 'Pick your device and tap the problems you are having.' },
    { icon: 'calendar-outline', title: 'Choose a branch and time', text: 'Pick the date and a free hour that fits your day.' },
    { icon: 'build-outline', title: 'We fix it', text: 'Drop off your phone. Follow every stage live in Repairs.' },
    { icon: 'star-outline', title: 'Pick up and rate', text: 'Collect your device, then rate your repair and save favourites.' },
  ];

  ngOnInit(): void {
    void this.booking.ensureLoaded();
  }

  retry(): void {
    void this.booking.retryLoad();
  }

  goToNewBooking(): void {
    void this.router.navigateByUrl('/tabs/new-booking');
  }

  goToMyRepairs(): void {
    void this.router.navigateByUrl('/tabs/my-repairs');
  }

  // ---------- service pop-up ----------
  openService(category: ServiceCategory): void {
    this.selected.set(category);
  }

  @HostListener('document:keydown.escape')
  closeService(): void {
    this.selected.set(null);
  }

  bookService(category: ServiceCategory): void {
    this.selected.set(null);
    void this.router.navigate(['/tabs/new-booking'], { queryParams: { issue: category.key } });
  }

  // ---------- offers ----------
  scrollOffers(direction: 1 | -1): void {
    const track = this.offerTrack()?.nativeElement;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(240, track.clientWidth * 0.8), behavior: 'smooth' });
  }

  goToOffer(index: number): void {
    const track = this.offerTrack()?.nativeElement;
    const card = track?.querySelector<HTMLElement>('.offer');
    if (!track || !card) return;
    track.scrollTo({ left: index * (card.offsetWidth + 12), behavior: 'smooth' });
  }

  onOfferScroll(): void {
    const track = this.offerTrack()?.nativeElement;
    const card = track?.querySelector<HTMLElement>('.offer');
    if (!track || !card) return;
    const index = Math.round(track.scrollLeft / (card.offsetWidth + 12));
    this.offerIndex.set(Math.min(this.offers.length - 1, Math.max(0, index)));
  }

  async useOffer(offer: Offer): Promise<void> {
    try {
      await navigator.clipboard.writeText(offer.code);
    } catch {
      // Clipboard blocked: the code is still shown on the toast.
    }
    const toast = await this.toast.create({
      message: `Code ${offer.code} copied. Mention it when you drop off your device.`,
      duration: 2800,
      position: 'top',
      color: 'success',
    });
    await toast.present();
    void this.router.navigate(['/tabs/new-booking'], {
      queryParams: offer.issue ? { issue: offer.issue } : {},
    });
  }

    // ---- mouse drag / wheel scrolling for the service category row ----
  private ovalDrag = { active: false, startX: 0, startLeft: 0, moved: false };

  dragStart(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return; // touch already scrolls natively
    const track = event.currentTarget as HTMLElement;
    this.ovalDrag = { active: true, startX: event.clientX, startLeft: track.scrollLeft, moved: false };
  }

  dragMove(event: PointerEvent): void {
    if (!this.ovalDrag.active) return;
    const track = event.currentTarget as HTMLElement;
    const dx = event.clientX - this.ovalDrag.startX;
    if (Math.abs(dx) > 5) this.ovalDrag.moved = true;
    track.scrollLeft = this.ovalDrag.startLeft - dx;
  }

  dragEnd(): void {
    this.ovalDrag.active = false;
  }

  /** Plain mouse wheel scrolls the row sideways when it can. */
  wheelScroll(event: WheelEvent): void {
    const track = event.currentTarget as HTMLElement;
    if (track.scrollWidth <= track.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    track.scrollLeft += event.deltaY;
  }

  /** A drag must not count as a tap on a category. */
  onOval(category: ServiceCategory): void {
    if (this.ovalDrag.moved) {
      this.ovalDrag.moved = false;
      return;
    }
    this.openService(category);
  }
}