import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Employee, Location, ShiftAssignment, ShiftSlot, DEFAULT_SHIFT_SLOTS, VACATION_SLOT, Warning } from '@/types';
import { defaultLocations, defaultEmployees, defaultAssignments } from '@/data/mockData';

interface AppContextType {
  isInitializing: boolean;
  isLoggedIn: boolean;
  login: (user: string, pass: string) => Promise<boolean>;
  logout: () => void;

  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (emp: Employee) => void;
  getEmployee: (id: string) => Employee | undefined;

  locations: Location[];
  addLocation: (name: string) => void;
  updateLocation: (id: string, name: string) => void;
  removeLocation: (id: string) => void;

  shiftSlots: ShiftSlot[];
  allSlots: ShiftSlot[];
  addShiftSlot: (slot: Omit<ShiftSlot, 'id'>) => void;
  updateShiftSlot: (slot: ShiftSlot) => void;
  removeShiftSlot: (id: string) => void;
  getShiftSlot: (id: string) => ShiftSlot | undefined;

  assignments: ShiftAssignment[];
  addAssignment: (a: Omit<ShiftAssignment, 'id'>) => void;
  removeAssignment: (id: string) => void;
  getAssignmentsForDate: (date: string, locationId: string) => ShiftAssignment[];
  getEmployeeMonthlyHours: (employeeId: string, year: number, month: number) => number;
  getEmployeeMonthlyShifts: (employeeId: string, year: number, month: number) => number;
  getEmployeeVacationDays: (employeeId: string, year: number, month: number) => number;

  getWarnings: (date: string) => Warning[];

  seasonMonths: number[];
  setSeasonMonths: (months: number[]) => void;

  highDemandDays: Set<string>;
  toggleHighDemand: (date: string) => void;
  isHighDemand: (date: string) => boolean;
}

interface PersistedState {
  employees: Employee[];
  locations: Location[];
  shiftSlots: ShiftSlot[];
  assignments: ShiftAssignment[];
  seasonMonths: number[];
  highDemandDays: string[];
}

const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'tt_auth_token';
const AppContext = createContext<AppContextType | null>(null);

const defaultState: PersistedState = {
  employees: defaultEmployees,
  locations: defaultLocations,
  shiftSlots: DEFAULT_SHIFT_SLOTS,
  assignments: defaultAssignments,
  seasonMonths: [4, 5, 6, 7, 8],
  highDemandDays: [],
};

function getSavedToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function saveToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function readStateFromApi(token: string): Promise<PersistedState> {
  const response = await fetch(`${API_BASE}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Konnte Daten nicht laden');
  }

  return response.json();
}

async function writeStateToApi(state: PersistedState, token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/state`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error('Konnte Daten nicht speichern');
  }
}

async function logoutFromApi(token: string): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedFromApi, setHasLoadedFromApi] = useState(false);
  const [token, setToken] = useState<string | null>(() => getSavedToken());
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getSavedToken()));
  const [employees, setEmployees] = useState<Employee[]>(defaultState.employees);
  const [locations, setLocations] = useState<Location[]>(defaultState.locations);
  const [shiftSlots, setShiftSlots] = useState<ShiftSlot[]>(defaultState.shiftSlots);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>(defaultState.assignments);
  const [seasonMonths, setSeasonMonthsState] = useState<number[]>(defaultState.seasonMonths);
  const [highDemandDays, setHighDemandDays] = useState<Set<string>>(new Set(defaultState.highDemandDays));

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const currentToken = getSavedToken();
      if (!currentToken) {
        if (mounted) {
          setIsLoggedIn(false);
          setIsInitializing(false);
          setHasLoadedFromApi(false);
        }
        return;
      }

      try {
        const state = await readStateFromApi(currentToken);
        if (!mounted) return;
        setToken(currentToken);
        setIsLoggedIn(true);
        setEmployees(state.employees ?? defaultState.employees);
        setLocations(state.locations ?? defaultState.locations);
        setShiftSlots(state.shiftSlots ?? defaultState.shiftSlots);
        setAssignments(state.assignments ?? defaultState.assignments);
        setSeasonMonthsState(state.seasonMonths ?? defaultState.seasonMonths);
        setHighDemandDays(new Set(state.highDemandDays ?? defaultState.highDemandDays));
        setHasLoadedFromApi(true);
      } catch (error) {
        console.error(error);
        clearToken();
        if (!mounted) return;
        setToken(null);
        setIsLoggedIn(false);
        setHasLoadedFromApi(false);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const persistedState = useMemo<PersistedState>(() => ({
    employees,
    locations,
    shiftSlots,
    assignments,
    seasonMonths,
    highDemandDays: Array.from(highDemandDays),
  }), [employees, locations, shiftSlots, assignments, seasonMonths, highDemandDays]);

  useEffect(() => {
    if (!hasLoadedFromApi || !isLoggedIn || !token) return;

    writeStateToApi(persistedState, token).catch(error => {
      console.error('Fehler beim Speichern:', error);
    });
  }, [persistedState, hasLoadedFromApi, isLoggedIn, token]);

  const allSlots = useMemo(() => [...shiftSlots, VACATION_SLOT], [shiftSlots]);

  const login = async (user: string, pass: string) => {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      if (!payload?.token) {
        return false;
      }

      saveToken(payload.token);
      setToken(payload.token);
      setIsLoggedIn(true);

      const state = await readStateFromApi(payload.token);
      setEmployees(state.employees ?? defaultState.employees);
      setLocations(state.locations ?? defaultState.locations);
      setShiftSlots(state.shiftSlots ?? defaultState.shiftSlots);
      setAssignments(state.assignments ?? defaultState.assignments);
      setSeasonMonthsState(state.seasonMonths ?? defaultState.seasonMonths);
      setHighDemandDays(new Set(state.highDemandDays ?? defaultState.highDemandDays));
      setHasLoadedFromApi(true);
      return true;
    } catch (error) {
      console.error('Login fehlgeschlagen:', error);
      return false;
    }
  };

  const logout = () => {
    const currentToken = getSavedToken();
    if (currentToken) {
      void logoutFromApi(currentToken);
    }
    clearToken();
    setToken(null);
    setIsLoggedIn(false);
    setHasLoadedFromApi(false);
    setEmployees(defaultState.employees);
    setLocations(defaultState.locations);
    setShiftSlots(defaultState.shiftSlots);
    setAssignments(defaultState.assignments);
    setSeasonMonthsState(defaultState.seasonMonths);
    setHighDemandDays(new Set(defaultState.highDemandDays));
  };

  const addEmployee = (emp: Omit<Employee, 'id'>) => {
    setEmployees(prev => [...prev, { ...emp, id: `emp-${Date.now()}` }]);
  };

  const updateEmployee = (emp: Employee) => {
    setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
  };

  const getEmployee = (id: string) => employees.find(e => e.id === id);

  const addLocation = (name: string) => {
    setLocations(prev => [...prev, { id: `loc-${Date.now()}`, name }]);
  };

  const updateLocation = (id: string, name: string) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, name } : l));
  };

  const removeLocation = (id: string) => {
    setLocations(prev => prev.filter(l => l.id !== id));
    setAssignments(prev => prev.filter(a => a.locationId !== id));
    setEmployees(prev => prev.map(employee => employee.preferredLocationId === id ? { ...employee, preferredLocationId: null } : employee));
  };

  const addShiftSlot = (slot: Omit<ShiftSlot, 'id'>) => {
    const id = `shift-${Date.now()}`;
    const hours = calcHours(slot.startTime, slot.endTime);
    setShiftSlots(prev => [...prev, { ...slot, id, hours }]);
  };

  const updateShiftSlot = (slot: ShiftSlot) => {
    const hours = calcHours(slot.startTime, slot.endTime);
    setShiftSlots(prev => prev.map(s => s.id === slot.id ? { ...slot, hours } : s));
  };

  const removeShiftSlot = (id: string) => {
    setShiftSlots(prev => prev.filter(s => s.id !== id));
    setAssignments(prev => prev.filter(a => a.shiftSlotId !== id));
  };

  const getShiftSlot = (id: string) => allSlots.find(s => s.id === id);

  const addAssignment = (a: Omit<ShiftAssignment, 'id'>) => {
    setAssignments(prev => [...prev, { ...a, id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);
  };

  const removeAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const getAssignmentsForDate = (date: string, locationId: string) =>
    assignments.filter(a => a.date === date && a.locationId === locationId);

  const getEmployeeMonthlyHours = (employeeId: string, year: number, month: number) => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return assignments
      .filter(a => a.employeeId === employeeId && a.date.startsWith(prefix) && a.shiftSlotId !== 'urlaub')
      .reduce((sum, a) => {
        const slot = allSlots.find(s => s.id === a.shiftSlotId);
        return sum + (slot?.hours || 0);
      }, 0);
  };

  const getEmployeeMonthlyShifts = (employeeId: string, year: number, month: number) => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return assignments.filter(a => a.employeeId === employeeId && a.date.startsWith(prefix) && a.shiftSlotId !== 'urlaub').length;
  };

  const getEmployeeVacationDays = (employeeId: string, year: number, month: number) => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const vacDates = new Set(assignments.filter(a => a.employeeId === employeeId && a.date.startsWith(prefix) && a.shiftSlotId === 'urlaub').map(a => a.date));
    return vacDates.size;
  };

  const getWarnings = (date: string): Warning[] => {
    const warnings: Warning[] = [];
    const dayAssignments = assignments.filter(a => a.date === date);

    for (const a of dayAssignments) {
      const emp = employees.find(e => e.id === a.employeeId);
      if (!emp) continue;
      const slot = allSlots.find(s => s.id === a.shiftSlotId);

      if (slot?.requiresSupervision && !emp.canSupervise) {
        warnings.push({ type: 'no-supervision', message: `${emp.firstName} ${emp.lastName} hat keine Badeaufsicht-Berechtigung`, employeeId: emp.id, date, severity: 'error' });
      }

      const empDayShifts = dayAssignments.filter(da => da.employeeId === a.employeeId && da.shiftSlotId !== 'urlaub');
      if (empDayShifts.length > 1) {
        warnings.push({ type: 'double-shift', message: `${emp.firstName} ${emp.lastName} hat mehrere Schichten`, employeeId: emp.id, date, severity: 'warning' });
      }

      const isOnVacation = dayAssignments.some(da => da.employeeId === a.employeeId && da.shiftSlotId === 'urlaub');
      if (isOnVacation && a.shiftSlotId !== 'urlaub') {
        warnings.push({ type: 'vacation-conflict', message: `${emp.firstName} ${emp.lastName} ist im Urlaub und eingeplant`, employeeId: emp.id, date, severity: 'error' });
      }
    }

    const seen = new Set<string>();
    return warnings.filter(w => {
      const key = `${w.type}-${w.employeeId}-${w.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const setSeasonMonths = (months: number[]) => {
    setSeasonMonthsState(months);
  };

  const toggleHighDemand = (date: string) => {
    setHighDemandDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const isHighDemand = (date: string) => highDemandDays.has(date);

  return (
    <AppContext.Provider value={{
      isInitializing,
      isLoggedIn,
      login,
      logout,
      employees,
      addEmployee,
      updateEmployee,
      getEmployee,
      locations,
      addLocation,
      updateLocation,
      removeLocation,
      shiftSlots,
      allSlots,
      addShiftSlot,
      updateShiftSlot,
      removeShiftSlot,
      getShiftSlot,
      assignments,
      addAssignment,
      removeAssignment,
      getAssignmentsForDate,
      getEmployeeMonthlyHours,
      getEmployeeMonthlyShifts,
      getEmployeeVacationDays,
      getWarnings,
      seasonMonths,
      setSeasonMonths,
      highDemandDays,
      toggleHighDemand,
      isHighDemand,
    }}>
      {children}
    </AppContext.Provider>
  );
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
