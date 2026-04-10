export const DEFAULT_SHIFT_SLOTS = [
  { id: 'kasse-frueh', label: 'Kasse Früh', requiresSupervision: false, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'kasse-spaet', label: 'Kasse Spät', requiresSupervision: false, startTime: '14:00', endTime: '20:00', hours: 6 },
  { id: 'aufsicht-frueh', label: 'Aufsicht Früh', requiresSupervision: true, startTime: '08:00', endTime: '14:00', hours: 6 },
  { id: 'aufsicht-spaet', label: 'Aufsicht Spät', requiresSupervision: true, startTime: '14:00', endTime: '20:00', hours: 6 },
];

export const defaultLocations = [
  { id: 'loc-1', name: 'Mainflingen Campingsee' },
  { id: 'loc-2', name: 'Zellhausen Badesee' },
];

export const defaultEmployees = [];
export const defaultAssignments = [];

export function createDefaultState() {
  return {
    auth: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin',
    },
    employees: defaultEmployees,
    locations: defaultLocations,
    shiftSlots: DEFAULT_SHIFT_SLOTS,
    assignments: defaultAssignments,
    seasonMonths: [4, 5, 6, 7, 8],
    highDemandDays: [],
  };
}
