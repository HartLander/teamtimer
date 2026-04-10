import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  currentDate: Date;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function ExportDialog({ open, onClose, currentDate }: ExportDialogProps) {
  const { locations, allSlots, getEmployee, getAssignmentsForDate } = useApp();

  const [showKasse, setShowKasse] = useState(true);
  const [showAufsicht, setShowAufsicht] = useState(true);
  const [showUrlaub, setShowUrlaub] = useState(true);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set(locations.map(l => l.id)));

  const selectedLocations = useMemo(
    () => locations.filter(location => selectedLocationIds.has(location.id)),
    [locations, selectedLocationIds]
  );

  const toggleLocation = (id: string) => {
    setSelectedLocationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!open) return null;

  const handleExport = () => {
    const filteredSlots = allSlots.filter(slot => {
      if (slot.isVacation) return showUrlaub;
      if (slot.requiresSupervision) return showAufsicht;
      return showKasse;
    });

    if (selectedLocations.length === 0 || filteredSlots.length === 0) {
      toast.error('Bitte mindestens einen Standort und eine Kategorie auswählen.');
      return;
    }

    const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    const monthLabel = format(currentDate, 'MMMM yyyy', { locale: de });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a3' });

    selectedLocations.forEach((location, locationIndex) => {
      if (locationIndex > 0) {
        doc.addPage('a3', 'portrait');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = { top: 12, right: 12, bottom: 10, left: 12 };
      const titleBlockHeight = 17;
      const headerHeight = 10.5;
      const tableX = margin.left;
      const tableY = margin.top + titleBlockHeight;
      const tableWidth = pageWidth - margin.left - margin.right;
      const tableHeight = pageHeight - tableY - margin.bottom;
      const dateWidth = 34;
      const slotWidth = (tableWidth - dateWidth) / filteredSlots.length;
      const rowHeight = tableHeight / (days.length + 1);
      const maxTextWidth = slotWidth - 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(25, 25, 25);
      doc.text(`Dienstplan – ${monthLabel}`, margin.left, margin.top + 4);
      doc.setFontSize(12);
      doc.text(location.name, margin.left, margin.top + 11);

      // Header
      const headerFill = 232;
      const altRowFill = 247;
      const normalRowFill = 255;
      const borderGray = 186;

      doc.setDrawColor(borderGray, borderGray, borderGray);
      doc.setLineWidth(0.2);
      doc.setFillColor(headerFill, headerFill, headerFill);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.rect(tableX, tableY, dateWidth, headerHeight, 'FD');
      doc.text('Datum', tableX + 2, tableY + 6.8);

      filteredSlots.forEach((slot, index) => {
        const x = tableX + dateWidth + index * slotWidth;
        doc.setFillColor(headerFill, headerFill, headerFill);
        doc.setTextColor(0, 0, 0);
        doc.rect(x, tableY, slotWidth, headerHeight, 'FD');
        doc.text(slot.label, x + 2, tableY + 6.8);
      });

      // Body rows
      days.forEach((day, rowIndex) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = getDay(day);
        const rowY = tableY + headerHeight + rowIndex * rowHeight;
        const rowFill = rowIndex % 2 === 1 ? altRowFill : normalRowFill;

        doc.setFillColor(rowFill, rowFill, rowFill);
        doc.setDrawColor(borderGray, borderGray, borderGray);
        doc.rect(tableX, rowY, dateWidth, rowHeight, 'FD');

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.6);
        doc.text(`${WEEKDAYS[dayOfWeek]} ${format(day, 'dd.MM')}`, tableX + 2, rowY + rowHeight / 2 + 1.3);

        filteredSlots.forEach((slot, colIndex) => {
          const x = tableX + dateWidth + colIndex * slotWidth;
          doc.setFillColor(rowFill, rowFill, rowFill);
          doc.rect(x, rowY, slotWidth, rowHeight, 'FD');

          const names = getAssignmentsForDate(dateStr, location.id)
            .filter(assignment => assignment.shiftSlotId === slot.id)
            .map(assignment => {
              const employee = getEmployee(assignment.employeeId);
              return employee ? `${employee.firstName} ${employee.lastName.charAt(0)}.` : '';
            })
            .filter(Boolean)
            .join('\n');

          if (!names) return;

          doc.setFontSize(9.1);
          doc.setTextColor(0, 0, 0);
          const lines = doc.splitTextToSize(names, maxTextWidth).slice(0, 2) as string[];
          const lineHeight = 3.6;
          const textStartY = rowY + rowHeight / 2 - ((lines.length - 1) * lineHeight) / 2 + 0.8;
          doc.text(lines, x + 2, textStartY);
        });
      });
    });

    doc.save(`Dienstplan_${format(currentDate, 'yyyy-MM')}.pdf`);
    toast.success('PDF wurde schwarz-weiß und besser lesbar exportiert.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-card shadow-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Dienstplan exportieren</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Kategorien</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="exp-kasse" checked={showKasse} onCheckedChange={value => setShowKasse(!!value)} />
                <Label htmlFor="exp-kasse" className="text-sm">Kasse</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="exp-aufsicht" checked={showAufsicht} onCheckedChange={value => setShowAufsicht(!!value)} />
                <Label htmlFor="exp-aufsicht" className="text-sm">Badeaufsicht</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="exp-urlaub" checked={showUrlaub} onCheckedChange={value => setShowUrlaub(!!value)} />
                <Label htmlFor="exp-urlaub" className="text-sm">Urlaub</Label>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Standorte</h3>
            <div className="space-y-2">
              {locations.map(loc => (
                <div key={loc.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`exp-loc-${loc.id}`}
                    checked={selectedLocationIds.has(loc.id)}
                    onCheckedChange={() => toggleLocation(loc.id)}
                  />
                  <Label htmlFor={`exp-loc-${loc.id}`} className="text-sm">{loc.name}</Label>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Jeder ausgewählte Standort wird auf genau einer eigenen Hochformat-Seite exportiert.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleExport} className="gap-2">
            <FileDown className="h-4 w-4" />
            Als PDF exportieren
          </Button>
        </div>
      </div>
    </div>
  );
}
