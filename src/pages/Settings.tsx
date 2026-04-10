import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ShiftSlot } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Check, X, MapPin, Clock, Shield, CalendarRange } from 'lucide-react';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default function SettingsPage() {
  const {
    locations, addLocation, updateLocation, removeLocation,
    shiftSlots, addShiftSlot, updateShiftSlot, removeShiftSlot,
    seasonMonths, setSeasonMonths,
  } = useApp();

  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState('');

  // Shift dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftSlot | null>(null);
  const emptyShiftForm = { label: '', startTime: '08:00', endTime: '14:00', requiresSupervision: false, hours: 6 };
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);

  // Location handlers
  const handleAddLocation = () => {
    if (!newLocationName.trim()) return;
    addLocation(newLocationName.trim());
    setNewLocationName('');
  };
  const startLocEdit = (id: string, name: string) => { setEditingLocId(id); setEditLocName(name); };
  const saveLocEdit = () => { if (editingLocId && editLocName.trim()) { updateLocation(editingLocId, editLocName.trim()); setEditingLocId(null); } };

  // Shift handlers
  const openNewShift = () => { setEditingShift(null); setShiftForm(emptyShiftForm); setShiftDialogOpen(true); };
  const openEditShift = (s: ShiftSlot) => {
    setEditingShift(s);
    setShiftForm({ label: s.label, startTime: s.startTime, endTime: s.endTime, requiresSupervision: s.requiresSupervision, hours: s.hours });
    setShiftDialogOpen(true);
  };
  const handleSaveShift = () => {
    if (!shiftForm.label.trim() || !shiftForm.startTime || !shiftForm.endTime) return;
    if (editingShift) {
      updateShiftSlot({ ...editingShift, ...shiftForm });
    } else {
      addShiftSlot(shiftForm);
    }
    setShiftDialogOpen(false);
  };

  const toggleSeasonMonth = (m: number) => {
    setSeasonMonths(seasonMonths.includes(m) ? seasonMonths.filter(x => x !== m) : [...seasonMonths, m].sort());
  };

  return (
    <div className="p-6 max-w-3xl mx-auto animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>

      {/* Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Standorte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              {editingLocId === loc.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editLocName} onChange={e => setEditLocName(e.target.value)} className="h-8" autoFocus />
                  <Button size="sm" variant="ghost" onClick={saveLocEdit}><Check className="h-4 w-4 text-success" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLocId(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-foreground">{loc.name}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startLocEdit(loc.id, loc.name)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => removeLocation(loc.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Input placeholder="Neuer Standort..." value={newLocationName} onChange={e => setNewLocationName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLocation()} />
            <Button onClick={handleAddLocation} disabled={!newLocationName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shift times - editable */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Schichtzeiten</CardTitle>
          <Button size="sm" onClick={openNewShift}>
            <Plus className="h-4 w-4 mr-1" /> Neue Schicht
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {shiftSlots.map(slot => (
            <div key={slot.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground text-sm">{slot.label}</span>
                <Badge variant="secondary" className="text-xs">{slot.startTime} – {slot.endTime}</Badge>
                <Badge variant="outline" className="text-xs">{slot.hours}h</Badge>
                {slot.requiresSupervision && (
                  <Badge className="employee-badge-aufsicht text-[10px] border-[hsl(var(--badge-aufsicht)/0.3)]" variant="outline">
                    Aufsicht
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEditShift(slot)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeShiftSlot(slot.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {shiftSlots.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Schichten konfiguriert</p>
          )}
        </CardContent>
      </Card>

      {/* Season months */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4" /> Saisonmonate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {MONTH_NAMES.map((name, i) => (
              <Button key={i} variant={seasonMonths.includes(i) ? 'default' : 'outline'} size="sm" onClick={() => toggleSeasonMonth(i)}>
                {name.slice(0, 3)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Admin-Zugang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
            <p>Benutzername: <span className="font-medium text-foreground">admin</span></p>
            <p>Passwort: <span className="font-medium text-foreground">admin</span></p>
            <p className="mt-2 text-xs text-muted-foreground">Passwortänderung in einer zukünftigen Version verfügbar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Shift Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Schicht bearbeiten' : 'Neue Schicht'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground">Bezeichnung *</label>
              <Input value={shiftForm.label} onChange={e => setShiftForm({ ...shiftForm, label: e.target.value })} placeholder="z.B. Kasse Früh" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Von *</label>
                <Input type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Bis *</label>
                <Input type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Erfordert Badeaufsicht</label>
              <Switch checked={shiftForm.requiresSupervision} onCheckedChange={v => setShiftForm({ ...shiftForm, requiresSupervision: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveShift}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
