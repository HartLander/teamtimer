import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, X, AlertTriangle, Info, Eye, EyeOff, MapPin, Sun, FileDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ExportDialog from '@/components/ExportDialog';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const LEFT_PANEL_STORAGE_KEY = 'teamtimer-planning-left-collapsed';
const RIGHT_PANEL_STORAGE_KEY = 'teamtimer-planning-right-collapsed';

const getInitialPanelState = (storageKey: string, collapseBelow: number) => {
  if (typeof window === 'undefined') return false;
  const saved = window.localStorage.getItem(storageKey);
  if (saved !== null) return saved === 'true';
  return window.innerWidth <= collapseBelow;
};

export default function Planning() {
  const {
    employees, locations, assignments, allSlots,
    addAssignment, removeAssignment,
    getAssignmentsForDate, getEmployee,
    getEmployeeMonthlyHours, getWarnings, getShiftSlot,
    toggleHighDemand, isHighDemand,
  } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [filterSupervision, setFilterSupervision] = useState<boolean | null>(null);
  const [dragEmployeeId, setDragEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [visibleLocationIds, setVisibleLocationIds] = useState<Set<string>>(new Set(locations.map(l => l.id)));
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
    setVisibleLocationIds(prev => {
      const updated = new Set(prev);
      locations.forEach(l => {
        if (!updated.has(l.id)) updated.add(l.id);
      });
      updated.forEach(id => {
        if (!locations.find(l => l.id === id)) updated.delete(id);
      });
      return updated;
    });
  }, [locations]);

  const visibleLocations = useMemo(() => locations.filter(l => visibleLocationIds.has(l.id)), [locations, visibleLocationIds]);

  const toggleLocation = (id: string) => {
    setVisibleLocationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const showOnlyLocation = (id: string) => {
    setVisibleLocationIds(new Set([id]));
  };

  const showAllLocations = () => {
    setVisibleLocationIds(new Set(locations.map(l => l.id)));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  }, [currentDate]);

  const activeEmployees = useMemo(() => {
    return employees
      .filter(e => e.active)
      .filter(e => !search || `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()))
      .filter(e => filterSupervision === null || e.canSupervise === filterSupervision);
  }, [employees, search, filterSupervision]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDragStart = (employeeId: string) => setDragEmployeeId(employeeId);

  const handleDrop = (date: string, locationId: string, slotId: string) => {
    if (!dragEmployeeId) return;
    const existing = assignments.find(
      a => a.employeeId === dragEmployeeId && a.date === date && a.locationId === locationId && a.shiftSlotId === slotId
    );
    if (existing) {
      toast.error('Bereits in dieser Schicht eingeplant');
      setDragEmployeeId(null);
      return;
    }
    const emp = getEmployee(dragEmployeeId);
    const slot = getShiftSlot(slotId);
    if (emp && slot?.requiresSupervision && !emp.canSupervise) {
      toast.warning(`${emp.firstName} ${emp.lastName} hat keine Badeaufsicht-Berechtigung!`);
    }
    addAssignment({ employeeId: dragEmployeeId, locationId, date, shiftSlotId: slotId });
    setDragEmployeeId(null);
  };

  const selEmp = selectedEmployee ? getEmployee(selectedEmployee) : null;
  const selEmpHours = selectedEmployee ? getEmployeeMonthlyHours(selectedEmployee, year, month) : 0;

  const kasseSlots = allSlots.filter(s => !s.requiresSupervision && !s.isVacation);
  const aufsichtSlots = allSlots.filter(s => s.requiresSupervision);
  const vacSlot = allSlots.filter(s => s.isVacation);
  type SlotGroup = { slot: typeof allSlots[number]; group: 'kasse' | 'aufsicht' | 'urlaub'; isFirstInGroup: boolean };
  const groupedSlots: SlotGroup[] = [
    ...kasseSlots.map((slot, index) => ({ slot, group: 'kasse' as const, isFirstInGroup: index === 0 })),
    ...aufsichtSlots.map((slot, index) => ({ slot, group: 'aufsicht' as const, isFirstInGroup: index === 0 })),
    ...vacSlot.map((slot, index) => ({ slot, group: 'urlaub' as const, isFirstInGroup: index === 0 })),
  ];
  const totalColsPerLoc = groupedSlots.length;

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden bg-background">
      <div
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-200',
          leftPanelCollapsed ? 'w-14' : 'w-72'
        )}
      >
        {leftPanelCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 p-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setLeftPanelCollapsed(false)}
              title="Mitarbeiterleiste ausklappen"
            >
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setLeftPanelCollapsed(true)}
                  title="Mitarbeiterleiste einklappen"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <div className="mt-2 flex gap-1">
                {([null, true, false] as const).map((v, i) => (
                  <Button
                    key={i}
                    variant={filterSupervision === v ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setFilterSupervision(v)}
                  >
                    {v === null ? 'Alle' : v ? 'Aufsicht' : 'Kasse'}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {activeEmployees.map(emp => {
                const hours = getEmployeeMonthlyHours(emp.id, year, month);
                return (
                  <div
                    key={emp.id}
                    draggable
                    onDragStart={() => handleDragStart(emp.id)}
                    onClick={() => setSelectedEmployee(emp.id)}
                    className={`cursor-grab rounded-lg border p-2 transition-all hover:shadow-sm active:cursor-grabbing ${
                      selectedEmployee === emp.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{emp.firstName} {emp.lastName.charAt(0)}.</span>
                      <span className={`employee-badge ${emp.canSupervise ? 'employee-badge-aufsicht' : 'employee-badge-kasse'}`}>
                        {emp.canSupervise ? 'BA' : 'K'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground gap-2">
                      <span className="whitespace-nowrap">{hours}h / {emp.monthlyTargetHours}h</span>
                      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (hours / Math.max(1, emp.monthlyTargetHours)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <h1 className="min-w-[180px] text-center text-lg font-semibold capitalize text-foreground">
              {format(currentDate, 'MMMM yyyy', { locale: de })}
            </h1>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setLeftPanelCollapsed(prev => !prev)}
            >
              {leftPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              Team
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setRightPanelCollapsed(prev => !prev)}
            >
              Info
              {rightPanelCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div className="hidden items-center gap-2 md:flex">
              <Info className="h-4 w-4" /> Drag & Drop
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: '92px' }} />
              {visibleLocations.flatMap(loc =>
                groupedSlots.map(groupedSlot => (
                  <col key={`col-${loc.id}-${groupedSlot.slot.id}`} />
                ))
              )}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                <th rowSpan={3} className="sticky left-0 z-30 w-[92px] border-r border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground align-bottom">
                  Datum
                </th>
                {visibleLocations.map((loc, locationIndex) => (
                  <th
                    key={loc.id}
                    colSpan={totalColsPerLoc}
                    className={cn(
                      'px-2 py-2 text-center text-xs font-semibold text-foreground border-b border-border',
                      locationIndex > 0 && 'border-l-2 border-l-primary/20'
                    )}
                  >
                    {loc.name}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                {visibleLocations.map((loc, locationIndex) => (
                  <>
                    {kasseSlots.length > 0 && (
                      <th
                        key={`${loc.id}-kasse`}
                        colSpan={kasseSlots.length}
                        className={cn(
                          'px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-kasse))]',
                          locationIndex > 0 && 'border-l-2 border-l-primary/20'
                        )}
                      >
                        Kasse
                      </th>
                    )}
                    {aufsichtSlots.length > 0 && (
                      <th
                        key={`${loc.id}-aufsicht`}
                        colSpan={aufsichtSlots.length}
                        className="border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)] px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-aufsicht))]"
                      >
                        Aufsicht
                      </th>
                    )}
                    {vacSlot.length > 0 && (
                      <th
                        key={`${loc.id}-urlaub`}
                        colSpan={vacSlot.length}
                        className="border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)] px-1 py-1 text-center text-[11px] font-medium text-[hsl(var(--badge-vacation))]"
                      >
                        Urlaub
                      </th>
                    )}
                  </>
                ))}
              </tr>
              <tr className="border-b border-border bg-card [&>th]:bg-card">
                {visibleLocations.map((loc, locationIndex) =>
                  groupedSlots.map((groupedSlot, slotIndex) => {
                    const isLocStart = locationIndex > 0 && slotIndex === 0;
                    const isGroupStart = groupedSlot.isFirstInGroup && groupedSlot.group !== 'kasse';
                    const borderClass = isLocStart
                      ? 'border-l-2 border-l-primary/20'
                      : isGroupStart
                      ? groupedSlot.group === 'aufsicht'
                        ? 'border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)]'
                        : 'border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)]'
                      : '';

                    return (
                      <th
                        key={`${loc.id}-${groupedSlot.slot.id}-head`}
                        className={`px-2 py-2 text-left text-[11px] font-medium text-muted-foreground ${borderClass}`}
                      >
                        {groupedSlot.slot.label}
                      </th>
                    );
                  })
                )}
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
                  <tr key={dateStr} className={`border-b border-border/50 transition-colors hover:bg-accent/30 ${isWeekend ? 'bg-primary/[0.02]' : ''} ${highDemand ? 'bg-warning/[0.04]' : ''}`}>
                    <td className={`sticky left-0 z-10 border-r border-border px-3 py-1.5 font-medium ${isWeekend ? 'bg-primary/[0.04]' : 'bg-card'} ${highDemand ? 'bg-warning/[0.06]' : ''}`}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleHighDemand(dateStr)}
                          className={`flex-shrink-0 rounded p-0.5 transition-colors ${highDemand ? 'text-warning bg-warning/20' : 'text-muted-foreground/30 hover:text-warning/60'}`}
                          title={highDemand ? 'Hoher Bedarf – klicken zum Entfernen' : 'Als Hoher Bedarf markieren (z.B. gutes Wetter)'}
                        >
                          <Sun className="h-3.5 w-3.5" />
                        </button>
                        <span className={`text-xs ${isWeekend ? 'text-primary font-semibold' : 'text-foreground'}`}>{WEEKDAYS[dayOfWeek]}</span>
                        <span className="text-sm text-foreground">{format(day, 'd')}</span>
                        {warnings.length > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
                      </div>
                    </td>
                    {visibleLocations.map((loc, locationIndex) =>
                      groupedSlots.map((groupedSlot, slotIndex) => {
                        const slot = groupedSlot.slot;
                        const cellAssignments = getAssignmentsForDate(dateStr, loc.id).filter(a => a.shiftSlotId === slot.id);
                        const isLocStart = locationIndex > 0 && slotIndex === 0;
                        const isGroupStart = groupedSlot.isFirstInGroup && groupedSlot.group !== 'kasse';
                        const borderClass = isLocStart
                          ? 'border-l-2 border-l-primary/20'
                          : isGroupStart
                          ? groupedSlot.group === 'aufsicht'
                            ? 'border-l-2 border-l-[hsl(var(--badge-aufsicht)/0.3)]'
                            : 'border-l-2 border-l-[hsl(var(--badge-vacation)/0.3)]'
                          : '';
                        return (
                          <td
                            key={`${loc.id}-${slot.id}-${dateStr}`}
                            className={`px-1.5 py-1 align-top ${borderClass}`}
                            onDragOver={e => {
                              e.preventDefault();
                              e.currentTarget.classList.add('bg-primary/10');
                            }}
                            onDragLeave={e => e.currentTarget.classList.remove('bg-primary/10')}
                            onDrop={e => {
                              e.preventDefault();
                              e.currentTarget.classList.remove('bg-primary/10');
                              handleDrop(dateStr, loc.id, slot.id);
                            }}
                          >
                            <div className={`shift-cell min-h-[3.5rem] ${slot.isVacation ? 'border-warning/30 bg-warning/[0.03]' : ''}`}>
                              {cellAssignments.map(a => {
                                const emp = getEmployee(a.employeeId);
                                if (!emp) return null;
                                const hasWarning = warnings.some(w => w.employeeId === emp.id);
                                return (
                                  <div
                                    key={a.id}
                                    className={`group mb-0.5 flex items-center justify-between rounded px-1.5 py-0.5 text-xs ${
                                      slot.isVacation ? 'employee-badge-vacation' : slot.requiresSupervision ? 'employee-badge-aufsicht' : 'employee-badge-kasse'
                                    } ${hasWarning ? 'ring-1 ring-warning' : ''}`}
                                  >
                                    <span className="truncate">{emp.firstName} {emp.lastName.charAt(0)}.</span>
                                    <button onClick={() => removeAssignment(a.id)} className="ml-1 opacity-0 transition-opacity group-hover:opacity-100">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-l border-border bg-card transition-all duration-200',
          rightPanelCollapsed ? 'w-14' : 'w-64'
        )}
      >
        {rightPanelCollapsed ? (
          <div className="flex h-full flex-col items-center gap-3 p-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setRightPanelCollapsed(false)}
              title="Infoleiste ausklappen"
            >
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
                <div className="flex items-center gap-1">
                  {visibleLocationIds.size < locations.length && (
                    <button onClick={showAllLocations} className="text-[10px] text-primary hover:underline">
                      Alle zeigen
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setRightPanelCollapsed(true)}
                    title="Infoleiste einklappen"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                {locations.map(loc => {
                  const isVisible = visibleLocationIds.has(loc.id);
                  const isOnlyOne = visibleLocationIds.size === 1 && isVisible;
                  return (
                    <div key={loc.id} className={`flex items-center justify-between rounded-md border px-2 py-1.5 transition-all ${isVisible ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'}`}>
                      <button
                        onClick={() => toggleLocation(loc.id)}
                        className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium text-foreground"
                      >
                        {isVisible ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                        <span className="truncate">{loc.name}</span>
                      </button>
                      {!isOnlyOne && isVisible && locations.length > 1 && (
                        <button
                          onClick={() => showOnlyLocation(loc.id)}
                          className="ml-1 whitespace-nowrap text-[10px] text-muted-foreground hover:text-primary"
                          title="Nur diesen Standort anzeigen"
                        >
                          Nur
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-foreground">Info</h3>
            {selEmp ? (
              <div className="animate-fade-in space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-sm font-medium text-foreground">{selEmp.firstName} {selEmp.lastName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{selEmp.employmentType}</div>
                  <Badge variant="outline" className={`mt-2 text-[10px] ${selEmp.canSupervise ? 'border-[hsl(var(--badge-aufsicht)/0.4)] text-[hsl(var(--badge-aufsicht))]' : 'border-[hsl(var(--badge-kasse)/0.4)] text-[hsl(var(--badge-kasse))]'}`}>
                    {selEmp.canSupervise ? 'Badeaufsicht ✓' : 'Nur Kasse'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Sollstunden</span><span className="font-medium text-foreground">{selEmp.monthlyTargetHours}h</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Geplant</span><span className="font-medium text-foreground">{selEmpHours}h</span></div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Differenz</span>
                    <span className={`font-medium ${selEmpHours - selEmp.monthlyTargetHours > 0 ? 'text-warning' : 'text-success'}`}>
                      {selEmpHours - selEmp.monthlyTargetHours > 0 ? '+' : ''}{selEmpHours - selEmp.monthlyTargetHours}h
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

            <div className="mt-6">
              <Button onClick={() => setExportOpen(true)} variant="outline" className="w-full gap-2">
                <FileDown className="h-4 w-4" />
                Exportieren
              </Button>
            </div>
          </div>
        )}
      </div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} currentDate={currentDate} />
    </div>
  );
}
