import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { UserAccount, UserAccountPayload } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, ShieldCheck, KeyRound, Search } from 'lucide-react';

const emptyForm: UserAccountPayload = {
  username: '',
  displayName: '',
  password: '',
  active: true,
  canManageKasse: true,
  canManageSupervision: false,
};

export default function AccountsPage() {
  const { currentUser, userAccounts, createUserAccount, updateUserAccount, deleteUserAccount } = useApp();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [form, setForm] = useState<UserAccountPayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filteredAccounts = useMemo(() => {
    return userAccounts.filter(account => {
      const haystack = `${account.displayName} ${account.username}`.toLowerCase();
      return !search || haystack.includes(search.toLowerCase());
    });
  }, [search, userAccounts]);

  if (!currentUser?.isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Dieser Bereich ist nur für Admins verfügbar.
      </div>
    );
  }

  const openCreate = () => {
    setEditingAccount(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (account: UserAccount) => {
    setEditingAccount(account);
    setForm({
      username: account.username,
      displayName: account.displayName,
      password: '',
      active: account.active,
      canManageKasse: account.canManageKasse,
      canManageSupervision: account.canManageSupervision,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim()) {
      toast.error('Benutzername und Anzeigename sind Pflichtfelder.');
      return;
    }

    if (!editingAccount && !form.password?.trim()) {
      toast.error('Bitte ein Passwort für das neue Konto vergeben.');
      return;
    }

    if (!form.canManageKasse && !form.canManageSupervision) {
      toast.error('Bitte mindestens Kasse oder Badeaufsicht erlauben.');
      return;
    }

    try {
      setSaving(true);
      if (editingAccount) {
        await updateUserAccount(editingAccount.id, form);
        toast.success('Konto gespeichert.');
      } else {
        await createUserAccount(form);
        toast.success('Konto erstellt.');
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Konto konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: UserAccount) => {
    if (!window.confirm(`Konto „${account.displayName}“ wirklich löschen?`)) return;
    try {
      await deleteUserAccount(account.id);
      toast.success('Konto gelöscht.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Konto konnte nicht gelöscht werden.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Konten</h1>
          <p className="text-sm text-muted-foreground">Zusätzliche Login-Konten mit Rechten für Kasse und Badeaufsicht.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Konto anlegen
        </Button>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Konto suchen..." className="pl-9" />
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Admin-Konto
          </div>
          Das Docker-/Unraid-Admin-Konto bleibt separat und kann hier nicht bearbeitet werden.
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Anzeigename</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Benutzername</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Rechte</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Noch keine zusätzlichen Konten angelegt.
                </td>
              </tr>
            ) : filteredAccounts.map(account => (
              <tr key={account.id} className="border-b border-border/50 align-top hover:bg-accent/20">
                <td className="px-4 py-3 font-medium text-foreground">{account.displayName}</td>
                <td className="px-4 py-3 text-muted-foreground">{account.username}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {account.canManageKasse && <Badge variant="outline">Kasse</Badge>}
                    {account.canManageSupervision && <Badge variant="outline">Badeaufsicht</Badge>}
                    <Badge variant="secondary">Urlaub</Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={account.active ? 'default' : 'secondary'}>{account.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(account)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Konto bearbeiten' : 'Konto anlegen'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Anzeigename *</label>
              <Input value={form.displayName} onChange={event => setForm(prev => ({ ...prev, displayName: event.target.value }))} placeholder="z. B. Kasse Team" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Benutzername *</label>
              <Input value={form.username} onChange={event => setForm(prev => ({ ...prev, username: event.target.value }))} placeholder="kasse-team" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Passwort {editingAccount ? '(nur ändern, wenn nötig)' : '*'}</label>
              <Input
                type="password"
                value={form.password ?? ''}
                onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
                placeholder={editingAccount ? 'Leer lassen = unverändert' : 'Passwort vergeben'}
              />
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyRound className="h-4 w-4 text-primary" /> Rechte
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Kasse bearbeiten</span>
                  <Switch checked={form.canManageKasse} onCheckedChange={value => setForm(prev => ({ ...prev, canManageKasse: value }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Badeaufsicht bearbeiten</span>
                  <Switch checked={form.canManageSupervision} onCheckedChange={value => setForm(prev => ({ ...prev, canManageSupervision: value }))} />
                </div>
                <p className="text-xs text-muted-foreground">Urlaub darf jedes Konto eintragen. Mitarbeitende und Einstellungen bleiben ebenfalls zugänglich.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium text-foreground">Konto aktiv</div>
                <div className="text-xs text-muted-foreground">Inaktive Konten können sich nicht anmelden.</div>
              </div>
              <Switch checked={form.active} onCheckedChange={value => setForm(prev => ({ ...prev, active: value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
