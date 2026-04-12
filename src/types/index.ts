export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  note: string;
  active: boolean;
  canSupervise: boolean;
  monthlyTargetHours: number;
  employmentType: string;
  preferredLocationId: string | null;
}

export interface Location {
  id: string;
  name: string;
}

export interface ShiftSlot {
  id: string;
  label: string;
  requiresSupervision: boolean;
  startTime: string;
  endTime: string;
  hours: number;
  isVacation?: boolean;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  locationId: string;
  date: string;
  shiftSlotId: string;
}

export interface Warning {
  type: 'no-supervision' | 'double-shift' | 'vacation-conflict' | 'hours-exceeded';
  message: string;
  employeeId: string;
  date: string;
  severity: 'error' | 'warning';
}

export interface SessionPermissions {
  canManageKasse: boolean;
  canManageSupervision: boolean;
  canManageVacation: boolean;
  canManageAccounts: boolean;
  canExportCombined: boolean;
}

export interface SessionUser {
  username: string;
  displayName: string;
  isAdmin: boolean;
  permissions: SessionPermissions;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  active: boolean;
  canManageKasse: boolean;
  canManageSupervision: boolean;
  createdAt: string;
}

export interface UserAccountPayload {
  username: string;
  displayName: string;
  password?: string;
  active: boolean;
  canManageKasse: boolean;
  canManageSupervision: boolean;
}

export const DEFAULT_SHIFT_SLOTS: ShiftSlot[] = [
  { id: 'kasse-frueh', label: 'Kasse Früh', requiresSupervision: false, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'kasse-spaet', label: 'Kasse Spät', requiresSupervision: false, startTime: '14:00', endTime: '20:00', hours: 6 },
  { id: 'aufsicht-frueh', label: 'Aufsicht Früh', requiresSupervision: true, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'aufsicht-spaet', label: 'Aufsicht Spät', requiresSupervision: true, startTime: '14:00', endTime: '20:00', hours: 6 },
];

export const VACATION_SLOT: ShiftSlot = {
  id: 'urlaub',
  label: 'Urlaub',
  requiresSupervision: false,
  startTime: '',
  endTime: '',
  hours: 0,
  isVacation: true,
};

export const EMPLOYMENT_TYPES = ['Werkstudent', 'Aushilfe', 'Minijob', 'Festanstellung', 'Sonstige'];
