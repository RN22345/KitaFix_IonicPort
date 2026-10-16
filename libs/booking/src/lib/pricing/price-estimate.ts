import { ServiceOption } from '../models/catalog.model';
import { ISSUE_DEFINITIONS, IssueFlagKey, Repair } from '../models/repair.model';
import { issueCoveredBy } from './service-match';

export interface PriceEstimate {
  base: number;
  issueFees: number;
  total: number;
}

/**
 * Recommended feature: price estimate from the chosen service + issues.
 * The service base price comes from Team 3; the issue bench fees live here.
 * The issue the service itself fixes is not charged again (Battery Replacement
 * + Battery issue = the service price only).
 */
export function estimatePrice(
  service: ServiceOption | null | undefined,
  issues: readonly IssueFlagKey[],
): PriceEstimate {
  const base = service?.base_price ?? 0;
  const covered = issueCoveredBy(service);
  const issueFees = ISSUE_DEFINITIONS.filter(
    (issue) => issues.includes(issue.key) && issue.key !== covered,
  ).reduce(
    (sum, issue) => sum + issue.extraFee,
    0,
  );
  return { base, issueFees, total: base + issueFees };
}

export function estimatePriceForRepair(
  repair: Repair,
  service: ServiceOption | null | undefined,
): PriceEstimate {
  const issues = ISSUE_DEFINITIONS.filter((issue) => repair[issue.key]).map((issue) => issue.key);
  return estimatePrice(service, issues);
}

export function formatCurrency(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${formatted}`;
}
