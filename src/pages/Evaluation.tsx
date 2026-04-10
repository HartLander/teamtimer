import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Evaluation() {
  const { employees, getEmployeeMonthlyHours, getEmployeeMonthlyShifts, getEmployeeVacationDays } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const data = useMemo(() => {
    return employees.filter(e => e.active).map(emp => {
      const hours = getEmployeeMonthlyHours(emp.id, year, month);
      const shifts = getEmployeeMonthlyShifts(emp.id, year, month);
      const vacation = getEmployeeVacationDays(emp.id, year, month);
      const diff = hours - emp.monthlyTargetHours;
      return { emp, hours, shifts, vacation, diff };
    });
  }, [employees, year, month, getEmployeeMonthlyHours, getEmployeeMonthlyShifts, getEmployeeVacationDays]);

  const totalHours = data.reduce((s, d) => s + d.hours, 0);
  const totalShifts = data.reduce((s, d) => s + d.shifts, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Auswertung</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalHours}h</div>
            <div className="text-xs text-muted-foreground">Geplante Stunden</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalShifts}</div>
            <div className="text-xs text-muted-foreground">Schichten</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.length}</div>
            <div className="text-xs text-muted-foreground">Aktive Mitarbeiter</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Mitarbeiter-Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Typ</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Soll</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Geplant</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Differenz</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Schichten</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Urlaub</th>
                  <th className="py-2 px-3 text-xs font-semibold text-muted-foreground">Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {data.map(({ emp, hours, shifts, vacation, diff }) => {
                  const pct = emp.monthlyTargetHours > 0 ? Math.round((hours / emp.monthlyTargetHours) * 100) : 0;
                  return (
                    <tr key={emp.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{emp.firstName} {emp.lastName}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{emp.employmentType}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{emp.monthlyTargetHours}h</td>
                      <td className="py-2.5 px-3 text-right font-medium text-foreground">{hours}h</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${diff > 0 ? 'text-warning' : diff < 0 ? 'text-destructive' : 'text-success'}`}>
                        {diff > 0 ? '+' : ''}{diff}h
                      </td>
                      <td className="py-2.5 px-3 text-right text-foreground">{shifts}</td>
                      <td className="py-2.5 px-3 text-right text-foreground">{vacation} Tage</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct > 100 ? 'bg-warning' : pct > 70 ? 'bg-success' : 'bg-primary'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
