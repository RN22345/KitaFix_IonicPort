import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  alertCircleOutline,
  buildOutline,
  calendarOutline,
  cashOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  constructOutline,
  createOutline,
  homeOutline,
  listOutline,
  locationOutline,
  logInOutline,
  personOutline,
  refreshOutline,
  saveOutline,
  timeOutline,
} from 'ionicons/icons';

/**
 * Offline requirement (Module Plan v4): register icons locally instead of
 * loading them from a CDN. Add new icon imports here when a screen needs one.
 */
export function registerIcons(): void {
  addIcons({
    'add-circle-outline': addCircleOutline,
    'alert-circle-outline': alertCircleOutline,
    'build-outline': buildOutline,
    'calendar-outline': calendarOutline,
    'cash-outline': cashOutline,
    'checkmark-circle-outline': checkmarkCircleOutline,
    'close-circle-outline': closeCircleOutline,
    'construct-outline': constructOutline,
    'create-outline': createOutline,
    'home-outline': homeOutline,
    'list-outline': listOutline,
    'location-outline': locationOutline,
    'log-in-outline': logInOutline,
    'person-outline': personOutline,
    'refresh-outline': refreshOutline,
    'save-outline': saveOutline,
    'time-outline': timeOutline,
  });
}
