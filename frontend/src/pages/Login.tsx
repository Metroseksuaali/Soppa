import { useState, FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { PotLogo } from '../components/PotLogo';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.login.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 h-20 w-20 rounded-3xl bg-brand text-white flex items-center justify-center shadow-sm">
            <PotLogo className="h-14 w-14" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.app.name}</h1>
          <p className="text-sm text-slate-500">{t.app.tagline}</p>
          <p className="text-xs text-slate-400 mt-1">{t.login.subtitle}</p>
        </div>

        {error && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div>
          <label className="label">{t.login.username}</label>
          <input
            className="input"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{t.login.password}</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? t.login.submitting : t.login.submit}
        </button>
      </form>
    </div>
  );
}
