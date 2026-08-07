import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, User } from '../api';
import { useAuth } from '../auth';
import { Spinner, ErrorMsg, Modal } from '../components/ui';
import { t } from '../i18n';

export function UsersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);

  if (!user?.is_admin) return <Navigate to="/" replace />;

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });

  return (
    <div className="space-y-4 md:max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.users.title}</h1>
        <button className="btn-primary py-2 px-3 text-sm" onClick={() => setShowCreate(true)}>
          {t.users.newButton}
        </button>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorMsg error={error} />}

      <ul className="space-y-2">
        {data?.map((u) => (
          <li key={u.id} className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">
                {u.display_name}
                {u.is_admin && <span className="chip bg-brand/10 text-brand-ink ml-2">{t.users.adminTag}</span>}
                {!u.active && (
                  <span className="chip bg-red-500/10 text-red-700 dark:text-red-300 ml-2">{t.users.inactiveTag}</span>
                )}
              </div>
              <div className="text-sm text-fg-subtle">@{u.username}</div>
            </div>
            <button className="text-sm text-brand-ink font-medium min-h-touch" onClick={() => setEdit(u)}>
              {t.common.edit}
            </button>
          </li>
        ))}
      </ul>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
      {edit && <EditUserModal user={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      api.post('/users', {
        username: username.trim(),
        display_name: displayName.trim(),
        password,
        is_admin: isAdmin,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setUsername('');
      setDisplayName('');
      setPassword('');
      setIsAdmin(false);
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t.users.createTitle}>
      <div className="space-y-3">
        <div>
          <label className="label">{t.login.username}</label>
          <input className="input" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="label">{t.users.displayName}</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t.users.passwordHint}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          {t.users.admin}
        </label>
        {mut.error && <ErrorMsg error={mut.error} />}
        <button
          className="btn-primary w-full"
          disabled={!username.trim() || !displayName.trim() || password.length < 6 || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? t.common.saving : t.users.create}
        </button>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [active, setActive] = useState(user.active ?? true);
  const [password, setPassword] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const body: any = { display_name: displayName.trim(), is_admin: isAdmin, active };
      if (password) body.password = password;
      return api.patch(`/users/${user.id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={t.users.editTitle(user.username)}>
      <div className="space-y-3">
        <div>
          <label className="label">{t.users.displayName}</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          {t.users.admin}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t.users.activeCheckbox}
        </label>
        <div>
          <label className="label">{t.users.newPasswordHint}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {mut.error && <ErrorMsg error={mut.error} />}
        <button className="btn-primary w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? t.common.saving : t.common.save}
        </button>
      </div>
    </Modal>
  );
}
