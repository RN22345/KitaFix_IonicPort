import { describe, expect, it } from 'vitest';
import { ServiceOption } from '../models/catalog.model';
import { estimatePrice, formatCurrency } from './price-estimate';

const screenReplacement = { id: 's1', name: 'Screen Replacement', base_price: 1499 } as ServiceOption;

describe('estimatePrice', () => {
  it('adds issue fees to the service base (test plan C4)', () => {
    expect(estimatePrice(screenReplacement, ['issue_battery'])).toEqual({
      base: 1499,
      issueFees: 250,
      total: 1749,
    });
  });

  it('sums several issues', () => {
    expect(estimatePrice(screenReplacement, ['issue_camera', 'issue_charging']).issueFees).toBe(500);
  });

  it('is zero without a service or issues', () => {
    expect(estimatePrice(null, [])).toEqual({ base: 0, issueFees: 0, total: 0 });
  });
});

describe('formatCurrency', () => {
  it('drops .00 on whole amounts and keeps cents otherwise', () => {
    expect(formatCurrency(1749, '₱')).toMatch(/^₱1.?749$/);
    expect(formatCurrency(10.5, '₱')).toMatch(/^₱10\.50$/);
  });
});

describe('estimatePrice - no double charge', () => {
  const battery = { id: 's2', name: 'Battery Replacement', base_price: 899 } as ServiceOption;

  it('does not add the fee of the issue the service already fixes', () => {
    expect(estimatePrice(battery, ['issue_battery'])).toEqual({ base: 899, issueFees: 0, total: 899 });
  });

  it('still adds fees for other issues', () => {
    expect(estimatePrice(battery, ['issue_battery', 'issue_camera']).total).toBe(1199);
  });
});
