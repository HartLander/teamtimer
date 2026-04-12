import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Info,
  MapPin,
  Sun,
  FileDown,
  Users,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ExportDialog from '@/components/ExportDialog';
import { cn } from '@/lib/utils';
import { ShiftSlot } from '@/types';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const LEFT_PANEL_STORAGE_KEY = 'teamtimer-planning-left-collapsed';
const RIGHT_PANEL_STORAGE_KEY = 'teamtimer-planning-right-collapsed';
const SELECTED_LOCATION_STORAGE_KEY = 'teamtimer-planning-selected-location';
const CURRENT_MONTH_STORAGE_KEY = 'teamtimer-planning-current-month';

const getInitialPanelState = (storageKey: string, collapseBelow: number) => {
  if (typeof window === 'undefined') return false;
  const saved = window.localStorage.getItem(storageKey);
  if (saved !== null) return saved === 'true';
  return window.innerWidth <= collapseBelow;
};

const clampDateToSeason = (date: Date, seasonMonths: number[]) => {
  const uniqueMonths = [...new Set(seasonMonths)].sort((a, b) => a - b);
  const year = date.getFullYear();

  if (uniqueMonths.length === 0) {
    return new Date(year, date.getMonth(), 1);
  }

  const currentMonth = date.getMonth();
  if (uniqueMonths.includes(currentMonth)) {
    return new Date(year, currentMonth, 1);
  }

  const closestMonth = uniqueMonths.reduce((best, month) => {
    const bestDistance = Math.abs(best - currentMonth);
    const nextDistance = Math.abs(month - currentMonth);
    return nextDistance < bestDistance ? month : best;
  }, uniqueMonths[0]);

  return new Date(year, closestMonth, 1);
};

const getInitialPlanningDate = (seasonMonths: number[]) => {
  const fallback = clampDateToSeason(new Date(), seasonMonths);
  if (typeof window === 'undefined') return fallback;

  const saved = window.localStorage.getItem(CURRENT_MONTH_STORAGE_KEY);
  if (!saved) return fallback;

  const parsed = new Date(saved);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return clampDateToSeason(parsed, seasonMonths);
};

const getInitialSelectedLocationId = (locationIds: string[]) => {
  if (typeof window === 'undefined') return locationIds[0] ?? null;
  const saved = window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY);
  if (saved && locationIds.includes(saved)) return saved;
  return locationIds[0] ?? null;
};

const getNextSeasonDate = (date: Date, seasonMonths: number[]) => {
  const uniqueMonths = [...new Set(seasonMonths)].sort((a, b) => a - b);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (uniqueMonths.length === 0) {
    return new Date(year, month + 1, 1);
  }

  const currentIndex = uniqueMonths.indexOf(month);
  if (currentIndex === -1) {
    return clampDateToSeason(date, seasonMonths);
  }

  if (currentIndex < uniqueMonths.length - 1) {
    return new Date(year, uniqueMonths[currentIndex + 1], 1);
  }

  return new Date(year + 1, uniqueMonths[0], 1);
};

const getPreviousSeasonDate = (date: Date, seasonMonths: number[]) => {
  const uniqueMonths = [...new Set(seasonMonths)].sort((a, b) => a - b);
  const year = date.getFullYear();
  const month = date.getMonth();

  if (uniqueMonths.length === 0) {
    return new Date(year, month - 1, 1);
  }

  const currentIndex = uniqueMonths.indexOf(month);
  if (currentIndex === -1) {
    return clampDateToSeason(date, seasonMonths);
  }

  if (currentIndex > 0) {
    return new Date(year, uniqueMonths[currentIndex - 1], 1);
  }

  return new Date(year - 1, uniqueMonths[uniqueMonths.length - 1], 1);
};

type SlotGroup = {
  slot: ShiftSlot;
  group: 'kasse' | 'aufsicht' | 'urlaub';
  isFirstInGroup: boolean;
};

export default function Planning() {
  const {
    employees,
    locations,
    assignments,
    allSlots,
    addAssignment,
    removeAssignment,
    getAssignmentsForDate,
    getEmployee,
    getEmployeeMonthlyHours,
    getWarnings,
    getShiftSlot,
    toggleHighDemand,
    isHighDemand,
    seasonMonths,
    currentUser,
    canManageSlot,
    canExportCombined,
  } = useApp();

  const [currentDate, setCurrentDate] = useState(() => getInitialPlanningDate(seasonMonths));
  const [search, setSearch] = useState('');
  const [filterSupervision, setFilterSupervision] = useState<boolean | null>(null);
  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => getInitialSelectedLocationId(locations.map(l => l.id)));
  const [exportOpen, setExportOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => getInitialPanelState(LEFT_PANEL_STORAGE_KEY, 1320));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => getInitialPanelState(RIGHT_PANEL_STORAGE_KEY, 1500));

  useEffect(() => {
    window.localStorage.setItem(LEFT_PANEL_STORAGE_KEY, String(leftPanelCollapsed));
  }, [leftPanelCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(rightPanelCollapsed));
  }, [rightPanelCollapsed]);

  useEffect(() => {
    setCurrentDate(prev => {
      const clamped = clampDateToSeason(prev, seasonMonths);
      return prev.getTime() === clamped.getTime() ? prev : clamped;
    });
  }, [seasonMonths]);

  useEffect(() => {
    window.localStorage.setItem(CURRENT_MONTH_STORAGE_KEY, currentDate.toISOString());
  }, [currentDate]);

  useEffect(() => {
    const locationIds = locations.map(location => location.id);
    setSelectedLocationId(prev => {
      if (prev && locationIds.includes(prev)) return prev;
      return getInitialSelectedLocationId(locationIds);
    });
  }, [locations]);

  useEffect(() => {
    if (selectedLocationId) {
      window.localStorage.setItem(SELECTED_LOCATION_STORAGE_KEY, selectedLocationId);
    }
  }, [selectedLocationId]);

  const selectedLocation = useMemo(
    () => locations.find(location => location.id === selectedLocationId) ?? locations[0] ?? null,
    [locations, selectedLocationId]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);

  const activeEmployees = useMemo(() => {
    return employees
      .filter(employee => employee.active)
      .filter(employee => !search || `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(search.toLowerCase()))
      .filter(employee => filterSupervision === null || employee.canSupervise === filterSupervision);
  }, [employees, search, filterSupervision]);

  const prevMonth = () => setCurrentDate(prev => getPreviousSeasonDate(prev, seasonMonths));
  const nextMonth = () => setCurrentDate(prev => getNextSeasonDate(prev, seasonMonths));
  const handleDragStart = (employeeId: string) => setDragEmployeeId(employeeId);

  const handleDrop = (date: string, locationId: string, slotId: string) => {
    if (!dragEmployeeId) return;

    const slot = getShiftSlot(slotId);
    if (!slot) {
      setDragEmployeeId(null);
      return;
    }

    if (!canManageSlot(slot)) {
      toast.error(`Du darfst ${slot.isVacation ? 'Urlaub' : slot.requiresSupervision ? 'Badeaufsicht' : 'Kasse'} nicht bearbeiten.`);
      setDragEmployeeId(null);
      return;
    }

    const existing = assignments.find(
      assignment =>
        assignment.employeeId === dragEmployeeId &&
        assignment.date === date &&
        assignment.locationId === locationId &&
        assignment.shiftSlotId === slotId
    );

    if (existing) {
      toast.error('Bereits in dieser Schicht eingeplant');
      setDragEmployeeId(null);
      return;
    }

    const employee = getEmployee(dragEmployeeId);
    if (employee && slot.requiresSupervision && !employee.canSupervise) {
      toast.warning(`${employee.firstName} ${employee.lastName} hat keine Badeaufsicht-Berechtigung.`);
    }

    addAssignment({ employeeId: dragEmployeeId, locationId, date, shiftSlotId: slotId });
    setDragEmployeeId(null);
  };

  const selectedEmployeeData = selectedEmployee ? getEmployee(selectedEmployee) : null;
  const selectedEmployeeHours = selectedEmployee ? getEmployeeMonthlyHours(selectedEmployee, year, month) : 0;
  const canEditAssignment = (slotId: string) => {
    const slot = getShiftSlot(slotId);
    return slot ? canManageSlot(slot) : false;
  };

  const kasseSlots = allSlots.filter(slot => !slot.requiresSupervision && !slot.isVacation);
  const aufsichtSlots = allSlots.filter(slot => slot.requiresSupervision);
  const vacationSlots = allSlots.filter(slot => slot.isVacation);

  const groupedSlots: SlotGroup[] = [
    ...kasseSlots.map((slot, index) => ({ slot, group: 'kasse' as const, isFirstInGroup: index === 0 })),
    ...aufsichtSlots.map((slot, index) => ({ slot, group: 'aufsicht' as const, isFirstInGroup: index === 0 })),
    ...vacationSlots.map((slot, index) => ({ slot, group: 'urlaub' as const, isFirstInGroup: index === 0 })),
  ];

  if (!selectedLocation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Bitte zuerst mindestens einen Standort anlegen.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden bg-background">
      <div
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-200',
          leftPanelCollapsed ? 'w-14' : 'w-60 xl:w-64'
        )}
      >
        {leftPanelCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 p-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setLeftPanelCollapsed(false)} title="Mitarbeiterleiste ausklappen">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="mt-2 flex flex-col items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180">Mitarbeiter</span>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Mitarbeiter</h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftPanelCollapsed(true)} title="Mitarbeiterleiste einklappen">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Suchen..." value={search} onChange={event => setSearch(event.target.value)} className="h-8 pl-8 text-sm" />
              </div>
              <div className="mt-2 flex gap-1">
                {([null, true, false] as const).map((value, index) => (
                  <Button
                    key={index}
                    variant={filterSupervision === value ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setFilterSupervision(value)}
                  >
                    {value === null ? 'Alle' : value ? 'Aufsicht' : 'Kasse'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {activeEmployees.map(employee => {
                const hours = getEmployeeMonthlyHours(employee.id, year, month);
                return (
                  <div
                    key={employee.id}
                    draggable
                    onDragStart={() => handleDragStart(employee.id)}
                    onClick={() => setSelectedEmployee(employee.id)}
                    className={cn(
                      'cursor-grab rounded-lg border p-2 transition-all hover:shadow-sm active:cursor-grabbing',
                      selectedEmployee === employee.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {employee.firstName} {employee.lastName.charAt(0)}.
                      </span>
                      <span className={cn('employee-badge', employee.canSupervise ? 'employee-badge-aufsicht' : 'employee-badge-kasse')}>
                        {employee.canSupervise ? 'BA' : 'K'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">{hours}h / {employee.monthlyTargetHours}h</span>
                      <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (hours / Math.max(1, employee.monthlyTargetHours)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeEmployees.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Keine passenden Mitarbeiter gefunden.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
          <div className="flex items-center gap-1 md:gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center text-lg font-semibold text-foreground">
              {format(currentDate, 'MMMM yyyy', { locale: de })}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {currentUser && (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <ShieldCheck className="h-3 w-3" />
                {currentUser.isAdmin ? 'Admin' : currentUser.displayName}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <MapPin className="h-3 w-3" />
              {selectedLocation.name}
            </Badge>
            <div className="hidden items-center gap-2 md:flex">
              <Info className="h-4 w-4" /> Drag & Drop
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setLeftPanelCollapsed(prev => !prev)}>
              {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />} Team
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setRightPanelCollapsed(prev => !prev)}>
              Info {rightPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: '92px' }} />
              {groupedSlots.map(groupedSlot => (
                <col key={`col-${selectedLocation.id}-${groupedSlot.slot.id}`} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                <th rowSpan={3} className="sticky left-0 z-30 w-[92px] border-r border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground align-bottom">
                  Datum
                </th>
                <th colSpan={groupedSlots.length} className="border-b border-border px-2 py-2 text-center text-xs font-semibold text-foreground">
                  {selectedLocation.name}
                </th>
              </tr>
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                {kasseSlots.length > 0 && <th colSpan={kasseSlots.length} className="px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-kasse))]">Kasse</th>}
                {aufsichtSlots.length > 0 && (
                  <th colSpan={aufsichtSlots.length} className="border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)] px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-aufsicht))]">
                    Aufsicht
                  </th>
                )}
                {vacationSlots.length > 0 && (
                  <th colSpan={vacationSlots.length} className="border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)] px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-vacation))]">
                    Urlaub
                  </th>
                )}
              </tr>
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                {groupedSlots.map(groupedSlot => {
                  const borderClass = groupedSlot.isFirstInGroup && groupedSlot.group !== 'kasse'
                    ? groupedSlot.group === 'aufsicht'
                      ? 'border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)]'
                      : 'border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)]'
                    : '';

                  return (
                    <th key={`${selectedLocation.id}-${groupedSlot.slot.id}-head`} className={`px-2 py-2 text-left text-[11px] font-medium text-muted-foreground ${borderClass}`}>
                      {groupedSlot.slot.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayOfWeek = getDay(day);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const warnings = getWarnings(dateStr);
                const highDemand = isHighDemand(dateStr);

                return (
                  <tr key={dateStr} className={cn('border-b border-border/50 transition-colors hover:bg-accent/30', isWeekend && 'bg-primary/[0.02]', highDemand && 'bg-warning/[0.04]')}>
                    <td className={cn('sticky left-0 z-10 border-r border-border px-3 py-1.5 font-medium', isWeekend ? 'bg-primary/[0.04]' : 'bg-card', highDemand && 'bg-warning/[0.06]')}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleHighDemand(dateStr)}
                          className={cn('flex-shrink-0 rounded p-0.5 transition-colors', highDemand ? 'bg-warning/20 text-warning' : 'text-muted-foreground/30 hover:text-warning/60')}
                          title={highDemand ? 'Hoher Bedarf – klicken zum Entfernen' : 'Als Hoher Bedarf markieren'}
                        >
                          <Sun className="h-3.5 w-3.5" />
                        </button>
                        <span className={cn('text-xs', isWeekend ? 'font-semibold text-primary' : 'text-foreground')}>
                          {WEEKDAYS[dayOfWeek]}
                        </span>
                        <span className="text-sm text-foreground">{format(day, 'd')}</span>
                        {warnings.length > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
                      </div>
                    </td>

                    {groupedSlots.map(groupedSlot => {
                      const slot = groupedSlot.slot;
                      const cellAssignments = getAssignmentsForDate(dateStr, selectedLocation.id).filter(
                        assignment => assignment.shiftSlotId === slot.id
                      );
                      const borderClass = groupedSlot.isFirstInGroup && groupedSlot.group !== 'kasse'
                        ? groupedSlot.group === 'aufsicht'
                          ? 'border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)]'
                          : 'border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)]'
                        : '';

                      return (
                        <td
                          key={`${selectedLocation.id}-${slot.id}-${dateStr}`}
                          className={`px-1.5 py-1 align-top ${borderClass}`}
                          onDragOver={event => {
                            if (!canManageSlot(slot)) return;
                            event.preventDefault();
                            event.currentTarget.classList.add('bg-primary/10');
                          }}
                          onDragLeave={event => event.currentTarget.classList.remove('bg-primary/10')}
                          onDrop={event => {
                            event.preventDefault();
                            event.currentTarget.classList.remove('bg-primary/10');
                            handleDrop(dateStr, selectedLocation.id, slot.id);
                          }}
                        >
                          <div className={cn('shift-cell min-h-[3.25rem]', slot.isVacation && 'border-warning/30 bg-warning/[0.03]', !canManageSlot(slot) && 'opacity-80')}>
                            {cellAssignments.map(assignment => {
                              const employee = getEmployee(assignment.employeeId);
                              if (!employee) return null;

                              const hasWarning = warnings.some(warning => warning.employeeId === employee.id);

                              return (
                                <div
                                  key={assignment.id}
                                  className={cn(
                                    'group mb-0.5 flex items-center justify-between rounded px-1.5 py-0.5 text-xs',
                                    slot.isVacation ? 'employee-badge-vacation' : slot.requiresSupervision ? 'employee-badge-aufsicht' : 'employee-badge-kasse',
                                    hasWarning && 'ring-1 ring-warning'
                                  )}
                                >
                                  <span className="truncate">{employee.firstName} {employee.lastName.charAt(0)}.</span>
                                  {canEditAssignment(assignment.shiftSlotId) && (
                                    <button onClick={() => removeAssignment(assignment.id)} className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn('flex h-full min-h-0 flex-shrink-0 flex-col border-l border-border bg-card transition-all duration-200', rightPanelCollapsed ? 'w-14' : 'w-52 xl:w-56')}>
        {rightPanelCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 p-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setRightPanelCollapsed(false)} title="Infoleiste ausklappen">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="mt-2 flex flex-col items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180">Info</span>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-y-auto p-3">
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Ansicht
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightPanelCollapsed(true)} title="Infoleiste einklappen">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">Es wird immer nur ein Standort gleichzeitig angezeigt.</p>
              <div className="space-y-1.5">
                {locations.map(location => {
                  const isActive = location.id === selectedLocation.id;
                  return (
                    <button
                      key={location.id}
                      onClick={() => setSelectedLocationId(location.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md border px-2 py-2 text-left transition-all',
                        isActive ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-foreground'
                      )}
                    >
                      <span className="truncate text-xs font-medium">{location.name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-foreground">Info</h3>
            <div className="mb-5 rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> Zugriff
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{currentUser?.displayName || 'Unbekannt'}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {currentUser?.isAdmin ? (
                    <Badge variant="default">Admin</Badge>
                  ) : (
                    <>
                      {currentUser?.permissions.canManageKasse && <Badge variant="outline">Kasse</Badge>}
                      {currentUser?.permissions.canManageSupervision && <Badge variant="outline">Badeaufsicht</Badge>}
                      <Badge variant="secondary">Urlaub</Badge>
                    </>
                  )}
                </div>
                {!currentUser?.isAdmin && (
                  <p className="mt-2 text-[11px]">Nicht erlaubte Schichten bleiben sichtbar, sind aber nicht bearbeitbar.</p>
                )}
              </div>
            </div>

            {selectedEmployeeData ? (
              <div className="animate-fade-in space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium text-foreground">
                    {selectedEmployeeData.firstName} {selectedEmployeeData.lastName}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{selectedEmployeeData.employmentType}</div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'mt-2 text-[10px]',
                      selectedEmployeeData.canSupervise
                        ? 'border-[hsl(var(--badge-aufsicht)/0.4)] text-[hsl(var(--badge-aufsicht))]'
                        : 'border-[hsl(var(--badge-kasse)/0.4)] text-[hsl(var(--badge-kasse))]'
                    )}
                  >
                    {selectedEmployeeData.canSupervise ? 'Badeaufsicht ✓' : 'Nur Kasse'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Sollstunden</span>
                    <span className="font-medium text-foreground">{selectedEmployeeData.monthlyTargetHours}h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Geplant</span>
                    <span className="font-medium text-foreground">{selectedEmployeeHours}h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Differenz</span>
                    <span className={cn('font-medium', selectedEmployeeHours - selectedEmployeeData.monthlyTargetHours > 0 ? 'text-warning' : 'text-success')}>
                      {selectedEmployeeHours - selectedEmployeeData.monthlyTargetHours > 0 ? '+' : ''}
                      {selectedEmployeeHours - selectedEmployeeData.monthlyTargetHours}h
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Mitarbeiter auswählen für Details</p>
            )}

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Legende</h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs"><div className="h-3 w-3 rounded-sm bg-[hsl(var(--badge-kasse)/0.2)]" /><span className="text-muted-foreground">Kasse</span></div>
                <div className="flex items-center gap-2 text-xs"><div className="h-3 w-3 rounded-sm bg-[hsl(var(--badge-aufsicht)/0.2)]" /><span className="text-muted-foreground">Badeaufsicht</span></div>
                <div className="flex items-center gap-2 text-xs"><div className="h-3 w-3 rounded-sm bg-[hsl(var(--badge-vacation)/0.2)]" /><span className="text-muted-foreground">Urlaub</span></div>
                <div className="flex items-center gap-2 text-xs"><AlertTriangle className="h-3 w-3 text-warning" /><span className="text-muted-foreground">Warnung</span></div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              {!canExportCombined && (
                <p className="text-[11px] text-muted-foreground">Die kombinierte Ansicht für mehrere Standorte ist nur für den Admin verfügbar.</p>
              )}
              <Button onClick={() => setExportOpen(true)} variant="outline" className="w-full gap-2">
                <FileDown className="h-4 w-4" />
                Exportieren
              </Button>
            </div>
          </div>
        )}
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        currentDate={currentDate}
        currentLocationId={selectedLocation.id}
      />
    </div>
  );
}
