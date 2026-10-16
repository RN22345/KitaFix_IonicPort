import { describe, expect, it } from 'vitest';
import { ServiceOption } from '../models/catalog.model';
import { issueCoveredBy, suggestService } from './service-match';

const services = [
  { id: 's1', name: 'Screen Replacement', base_price: 1499 },
  { id: 's2', name: 'Battery Replacement', base_price: 899 },
  { id: 's3', name: 'Charging Port Repair', base_price: 650 },
  { id: 's4', name: 'Water Damage Check', base_price: 1200 },
  { id: 's5', name: 'Software Reset', base_price: 500 },
] as ServiceOption[];

describe('issueCoveredBy', () => {
  it('maps service names to the issue they fix', () => {
    expect(issueCoveredBy(services[0])).toBe('issue_screen');
    expect(issueCoveredBy(services[2])).toBe('issue_charging');
    expect(issueCoveredBy(services[4])).toBe('issue_software');
  });

  it('returns null for services without a matching issue', () => {
    expect(issueCoveredBy(services[3])).toBeNull();
    expect(issueCoveredBy(null)).toBeNull();
  });
});

describe('suggestService', () => {
  it('picks the service for a single issue', () => {
    expect(suggestService(services, ['issue_battery'])?.name).toBe('Battery Replacement');
  });

  it('picks the main (most expensive) job when several issues match', () => {
    expect(suggestService(services, ['issue_battery', 'issue_screen'])?.name).toBe('Screen Replacement');
  });

  it('returns null when no service fits (camera only)', () => {
    expect(suggestService(services, ['issue_camera'])).toBeNull();
    expect(suggestService(services, [])).toBeNull();
  });
});
