import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setUser } from '../../store/auth.reducer';
import { login } from '../../helpers/authHelpers';
import Button from '../ui/Button';
import GoogleButton from './GoogleButton';
import AppleButton from './AppleButton';

const inputClass =
  'rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

function safeInternalPath(candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  return candidate;
}

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const afterLoginPath = useMemo(() => {
    const nextParam = safeInternalPath(searchParams.get('next'));
    const from = location.state?.from;
    const fromRouter =
      from?.pathname != null
        ? safeInternalPath(`${from.pathname}${from.search || ''}`)
        : null;
    return nextParam || fromRouter || '/';
  }, [location.state, searchParams]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login({ username, password });
      dispatch(setUser(user));
      toast.success('Signed in');
      navigate(afterLoginPath);
    } catch (error) {
      toast.error(error.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Username</span>
        <input
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <Button type="submit" disabled={submitting} size="lg">
        {submitting ? 'Signing in' : 'Sign in'}
      </Button>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-sortable-text-secondary">
        <div className="h-px flex-1 bg-white/10" />
        <span>or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <GoogleButton />
      <AppleButton />
    </form>
  );
}
