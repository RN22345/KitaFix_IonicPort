import { ServiceOption } from '../models/catalog.model';
import { ISSUE_DEFINITIONS, IssueFlagKey } from '../models/repair.model';

/**
 * Which issue a shop service fixes, by words in the service name (the service
 * list belongs to Team 3, so we match names instead of hard-coding ids).
 * Camera and speaker/mic have no dedicated service yet.
 */
const ISSUE_SERVICE_WORDS: Partial<Record<IssueFlagKey, readonly string[]>> = {
  issue_screen: ['screen', 'display', 'lcd'],
  issue_battery: ['battery'],
  issue_charging: ['charging', 'charger', 'port'],
  issue_software: ['software', 'reset', 'firmware'],
  issue_camera: ['camera'],
  issue_audio: ['speaker', 'audio', 'microphone', 'mic '],
};

/** The issue a service is meant for, or null (e.g. "Water Damage Check"). */
export function issueCoveredBy(service: Pick<ServiceOption, 'name'> | null | undefined): IssueFlagKey | null {
  if (!service) return null;
  const name = ` ${service.name.toLowerCase()} `;
  for (const issue of ISSUE_DEFINITIONS) {
    if (ISSUE_SERVICE_WORDS[issue.key]?.some((word) => name.includes(word))) {
      return issue.key;
    }
  }
  return null;
}

/**
 * The main job for the picked issues: among services that fix one of them,
 * the one with the highest base price (the other issues are added as fees).
 * Null when no service fits (e.g. only Camera picked).
 */
export function suggestService(
  services: readonly ServiceOption[],
  issues: readonly IssueFlagKey[],
): ServiceOption | null {
  const matches = services.filter((service) => {
    const covered = issueCoveredBy(service);
    return covered !== null && issues.includes(covered);
  });
  if (matches.length === 0) return null;
  return matches.reduce((best, service) => (service.base_price > best.base_price ? service : best));
}

const GENERAL_SERVICE_WORDS = ['diagnos', 'general', 'inspection', 'assessment', 'check-up', 'checkup'];

/**
 * The service stored on a booking. The customer never picks it: it follows
 * from the issues (repairs.service_id is required). When no service fixes the
 * picked issues, a general one is used - "Diagnosis"/"General..." if Team 3
 * has one, otherwise the cheapest - and the shop sees the issue flags anyway.
 */
export function serviceForIssues(
  services: readonly ServiceOption[],
  issues: readonly IssueFlagKey[],
): ServiceOption | null {
  const main = suggestService(services, issues);
  if (main || services.length === 0) return main;
  const general = services.find((service) =>
    GENERAL_SERVICE_WORDS.some((word) => service.name.toLowerCase().includes(word)),
  );
  return general ?? services.reduce((cheapest, service) => (service.base_price < cheapest.base_price ? service : cheapest));
}
