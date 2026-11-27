import { QueueRepair, ServiceItem, ServiceLog } from '../../models/repair-ops.model';

const base = {
  location: 'Main Branch - Downtown',
  booking_time: '10:00:00',
  issue_screen: false,
  issue_battery: false,
  issue_charging: false,
  issue_camera: false,
  issue_audio: false,
  issue_software: false,
  issue_description: null,
  staff_notes: null,
  repair_started_at: null,
  service_name_snapshot: null,
  service_price_snapshot: null,
  service_price: null,
  confirmed_by: null,
  confirmed_at: null,
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
};

/** .ts placeholder data so the module runs offline (Module Plan v4). */
export const MOCK_QUEUE: QueueRepair[] = [
  { ...base, id: 'a1000000-0000-4000-8000-000000000001', customer_id: 'c1', service_id: 's1',
    device_brand: 'Apple', device_model: 'iPhone 14', booking_date: '2026-10-05', issue_screen: true,
    status: 'in_progress', technician_id: 't1', confirmed_by: 'admin', confirmed_at: '2026-09-28T09:10:00Z',
    customer_name: 'Jake Villanueva', service_name: 'Screen Replacement', technician_name: 'Marco Reyes' },
  { ...base, id: 'a1000000-0000-4000-8000-000000000002', customer_id: 'c2', service_id: 's2',
    device_brand: 'Samsung', device_model: 'Galaxy A54', booking_date: '2026-10-06', issue_battery: true,
    status: 'pending', technician_id: null,
    customer_name: 'Liza Manalo', service_name: 'Battery Replacement', technician_name: null },
  { ...base, id: 'a1000000-0000-4000-8000-000000000003', customer_id: 'c3', service_id: 's3',
    device_brand: 'Apple', device_model: 'iPad 9th Gen', booking_date: '2026-10-06', booking_time: '11:00:00',
    issue_charging: true, issue_software: true, status: 'pending', technician_id: null,
    customer_name: 'Paolo Reyes', service_name: 'Water Damage Repair', technician_name: null },
  { ...base, id: 'a1000000-0000-4000-8000-000000000004', customer_id: 'c4', service_id: 's4',
    device_brand: 'Xiaomi', device_model: 'Redmi Note 12', booking_date: '2026-10-04', issue_charging: true,
    status: 'testing', technician_id: 't2', confirmed_by: 'admin', confirmed_at: '2026-09-27T14:32:00Z',
    customer_name: 'Ana Cruz', service_name: 'Other Repair', technician_name: 'Dina Villanueva' },
  { ...base, id: 'a1000000-0000-4000-8000-000000000005', customer_id: 'c5', service_id: 's1',
    device_brand: 'Oppo', device_model: 'A78', booking_date: '2026-10-02', issue_screen: true,
    status: 'completed', technician_id: 't3', confirmed_by: 'admin', confirmed_at: '2026-09-25T11:05:00Z',
    customer_name: 'Mark Bautista', service_name: 'Screen Replacement', technician_name: 'Kevin Lim' },
  { ...base, id: 'a1000000-0000-4000-8000-000000000006', customer_id: 'c6', service_id: 's2',
    device_brand: 'Apple', device_model: 'iPhone 11', booking_date: '2026-10-07', booking_time: '14:00:00',
    issue_battery: true, status: 'pending', technician_id: null,
    customer_name: 'Grace Tan', service_name: 'Battery Replacement', technician_name: null },
  { ...base, id: 'a1000000-0000-4000-8000-000000000007', customer_id: 'c7', service_id: 's4',
    device_brand: 'Vivo', device_model: 'Y36', booking_date: '2026-10-03', issue_audio: true,
    status: 'cancelled', technician_id: null,
    customer_name: 'Ben Aquino', service_name: 'Other Repair', technician_name: null },
];

export const MOCK_SERVICE_ITEMS: ServiceItem[] = [
  { id: 's1', name: 'Screen Replacement', description: 'Cracked or unresponsive screen', base_price: 1200, active: true, created_at: '', updated_at: '' },
  { id: 's2', name: 'Battery Replacement', description: 'Battery not lasting long', base_price: 800, active: true, created_at: '', updated_at: '' },
  { id: 's3', name: 'Water Damage Repair', description: 'Liquid damage / not powering on', base_price: 1500, active: true, created_at: '', updated_at: '' },
  { id: 's4', name: 'Other Repair', description: 'Hardware / software issues', base_price: 500, active: true, created_at: '', updated_at: '' },
];

/** The technician the offline demo signs in as when mockRole is 'technician'. */
export const MOCK_TECHNICIAN_ID = 't1';

export const MOCK_TECHNICIAN_NAMES: Record<string, string> = {
  t1: 'Marco Reyes',
  t2: 'Dina Villanueva',
  t3: 'Kevin Lim',
};

/** .ts placeholder service history (where / when / details of technician actions). */
export const MOCK_SERVICE_LOGS: ServiceLog[] = [
  { id: 'e1000000-0000-4000-8000-000000000001', repair_id: 'a1000000-0000-4000-8000-000000000001',
    technician_id: 't1', technician_name: 'Marco Reyes', action_type: 'inspection',
    location: 'Main Branch - Downtown, Bench 2', performed_at: '2026-10-05T02:15:00Z',
    details: 'Opened the device. Cracked glass and a damaged digitizer flex cable. Battery and board look fine.',
    logged_by: 'mock-tech', logged_by_name: 'Marco Reyes', created_at: '2026-10-05T02:20:00Z' },
  { id: 'e1000000-0000-4000-8000-000000000002', repair_id: 'a1000000-0000-4000-8000-000000000001',
    technician_id: 't1', technician_name: 'Marco Reyes', action_type: 'repair',
    location: 'Main Branch - Downtown, Bench 2', performed_at: '2026-10-05T03:40:00Z',
    details: 'Replaced the screen assembly and re-seated the flex cable. Touch responds in all areas.',
    logged_by: 'mock-tech', logged_by_name: 'Marco Reyes', created_at: '2026-10-05T03:45:00Z' },
  { id: 'e1000000-0000-4000-8000-000000000003', repair_id: 'a1000000-0000-4000-8000-000000000004',
    technician_id: 't2', technician_name: 'Dina Villanueva', action_type: 'testing',
    location: 'Main Branch - Downtown, Test station', performed_at: '2026-10-04T06:10:00Z',
    details: 'Charging test: 30 minutes on the original cable, steady 18W draw, no heat.',
    logged_by: 'mock-admin', logged_by_name: 'Mock Admin', created_at: '2026-10-04T06:12:00Z' },
];
