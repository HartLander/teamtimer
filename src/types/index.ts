export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  note: string;
  active: boolean;
  canSupervise: boolean; // Badeaufsicht
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
  date: string; // YYYY-MM-DD
  shiftSlotId: string; // references ShiftSlot.id or 'urlaub'
}

export interface Warning {
  type: 'no-supervision' | 'double-shift' | 'vacation-conflict' | 'hours-exceeded';
  message: string;
  employeeId: string;
  date: string;
  severity: 'error' | 'warning';
}

export const DEFAULT_SHIFT_SLOTS: ShiftSlot[] = [
  { id: 'kasse-frueh', label: 'Kasse Früh', requiresSupervision: false, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'kasse-spaet', label: 'Kasse Spät', requiresSupervision: false, startTime: '14:00', endTime: '20:00', hours: 6 },
  { id: 'aufsicht-frueh', label: 'Aufsicht Früh', requiresSupervision: true, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'aufsicht-spaet', label: 'Aufsicht Spät', requiresSupervision: true, startTime: '14:00', endTime: '20:00', hours: 6 },
];

export const VACATION_SLOT: ShiftSlot = {
  id: 'urlaub', label: 'Urlaub', requiresSupervision: false, startTime: '', endTime: '', hours: 0, isVacation: true,
};

export const EMPLOYMENT_TYPES = ['Werkstudent', 'Aushilfe', 'Minijob', 'Festanstellung', 'Sonstige'];
