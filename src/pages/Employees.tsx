import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Employee, EMPLOYMENT_TYPES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit2, UserX, UserCheck, Phone, StickyNote } from 'lucide-react';

export default function Employees() {
  const { employees, addEmployee, updateEmployee, locations } = useApp();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const emptyForm: Omit<Employee, 'id'> = {
    firstName: '', lastName: '', phone: '', note: '',
    active: true, canSupervise: false, monthlyTargetHours: 40,
    employmentType: 'Aushilfe', preferredLocationId: null,
  };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return employees
      .filter(e => !search || `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()))
      .filter(e => filterActive === null || e.active === filterActive);
  }, [employees, search, filterActive]);

  const openNew = () => { setEditingEmployee(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (e: Employee) => { setEditingEmployee(e); setForm(e); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.firstName || !form.lastName) return;
    if (editingEmployee) {
      updateEmployee({ ...editingEmployee, ...form });
    } else {
      addEmployee(form);
    }
    setDialogOpen(false);
  };

  const toggleActive = (emp: Employee) => {
    updateEmployee({ ...emp, active: !emp.active });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mitarbeiter</h1>
          <p className="text-sm text-muted-foreground">{employees.filter(e => e.active).length} aktiv · {employees.length} gesamt</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Mitarbeiter anlegen
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {([null, true, false] as const).map(v => (
            <Button
              key={String(v)}
              variant={filterActive === v ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterActive(v)}
            >
              {v === null ? 'Alle' : v ? 'Aktiv' : 'Inaktiv'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Name</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Typ</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Telefon</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Rolle</th>
              <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground">Soll/Monat</th>
              <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Notiz</th>
              <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr
                key={emp.id}
                className={`border-b border-border/50 transition-colors hover:bg-accent/30 ${!emp.active ? 'opacity-50' : ''}`}
              >
                <td className="py-2.5 px-4 font-medium text-foreground">
                  {emp.firstName} {emp.lastName}
                </td>
                <td className="py-2.5 px-4 text-muted-foreground">{emp.employmentType}</td>
                <td className="py-2.5 px-4 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {emp.phone}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <Badge
                    variant="outline"
                    className={
                      !emp.active
                        ? 'employee-badge-inactive border-muted-foreground/30'
                        : emp.canSupervise
                        ? 'employee-badge-aufsicht border-[hsl(var(--badge-aufsicht)/0.3)]'
                        : 'employee-badge-kasse border-[hsl(var(--badge-kasse)/0.3)]'
                    }
                  >
                    {!emp.active ? 'Inaktiv' : emp.canSupervise ? 'Badeaufsicht' : 'Kasse'}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-right text-foreground">{emp.monthlyTargetHours}h</td>
                <td className="py-2.5 px-4 text-muted-foreground text-xs max-w-[160px] truncate">
                  {emp.note && (
                    <span className="flex items-center gap-1">
                      <StickyNote className="h-3 w-3 flex-shrink-0" /> {emp.note}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(emp)}>
                      <Edit2 className="h-3 w-3 mr-1" /> Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 text-xs ${emp.active ? 'text-destructive hover:text-destructive' : 'text-success hover:text-success'}`}
                      onClick={() => toggleActive(emp)}
                    >
                      {emp.active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Mitarbeiter gefunden</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Vorname *</label>
                <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Nachname *</label>
                <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Telefon</label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Beschäftigungsart</label>
              <Select value={form.employmentType} onValueChange={v => setForm({ ...form, employmentType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Bevorzugter Standort</label>
              <Select value={form.preferredLocationId || 'none'} onValueChange={v => setForm({ ...form, preferredLocationId: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Standort</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Monatliche Sollstunden</label>
              <Input type="number" value={form.monthlyTargetHours} onChange={e => setForm({ ...form, monthlyTargetHours: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Badeaufsicht erlaubt</label>
              <Switch checked={form.canSupervise} onCheckedChange={v => setForm({ ...form, canSupervise: v })} />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Notiz</label>
              <Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
