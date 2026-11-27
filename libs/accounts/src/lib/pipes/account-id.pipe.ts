import { Pipe, PipeTransform } from '@angular/core';

const ROLE_PREFIX: Record<string, string> = {
  admin: 'AD',
  technician: 'TC',
  customer: 'CS',
};

// "CS-26111567": the letters follow the role, the 8 digits never change
export function formatAccountId(role: string | null | undefined, accountNo: string | null | undefined): string {
  if (!accountNo) return '';
  const prefix = ROLE_PREFIX[String(role)];
  return prefix ? `${prefix}-${accountNo}` : accountNo;
}

@Pipe({ name: 'accountId', standalone: true })
export class AccountIdPipe implements PipeTransform {
  transform(accountNo: string | null | undefined, role?: string | null): string {
    return formatAccountId(role, accountNo);
  }
}