import { describe, expect, it } from 'vitest';
import { Repair, problemSummary } from './repair.model';

const repair = (fields: Partial<Repair>) =>
  ({
    issue_screen: false,
    issue_battery: false,
    issue_charging: false,
    issue_camera: false,
    issue_audio: false,
    issue_software: false,
    issue_description: null,
    ...fields,
  }) as Repair;

describe('problemSummary', () => {
  it('lists the picked issues', () => {
    expect(problemSummary(repair({ issue_screen: true, issue_battery: true }))).toBe(
      'Screen, Battery',
    );
  });

  it('adds the optional note after the issues', () => {
    expect(problemSummary(repair({ issue_camera: true, issue_description: ' dropped it ' }))).toBe(
      'Camera · dropped it',
    );
  });

  it('shows just the note for bookings made with the free-text-only form', () => {
    expect(problemSummary(repair({ issue_description: 'won’t turn on' }))).toBe(
      'won’t turn on',
    );
  });
});
