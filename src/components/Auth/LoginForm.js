import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setUser } from '../../store/auth.reducer';
import {
  login,
  fetchGoogleLinkPending,
  completeGoogleLink,
  cancelGoogleLink,
} from '../../helpers/authHelpers';
import Button from '../ui/Button';
import GoogleButton from './GoogleButton';
import AppleButton from './AppleButton';

const inputClass =
  'rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

const authCtaClass = 'w-full md:max-w-auth-cta md:self-center';

const LOGIN_OAUTH_ERROR_MESSAGES = {
  apple: 'Apple sign-in did not complete. Please try again.',
  google: 'Google sign-in did not complete. Please try again.',
  google_email_conflict:
    'That email is already linked to a different Google account. Sign in with the method you used before.',
  google_oauth_only:
    'That email is registered without a password. Sign in with Apple or your original sign-in method.',
  google_needs_email:
    'Google did not share an email address. Check your Google account permissions and try again.',
};

const LOGIN_OAUTH_ERROR_FALLBACK =
  'Sign-in with Google or Apple did not complete. Please try again.';

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
  const [linkPassword, setLinkPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [linkChecked, setLinkChecked] = useState(false);
  const [linkPayload, setLinkPayload] = useState({ pending: false });
  const lastErrorToastKey = useRef(null);

  const afterLoginPath = useMemo(() => {
    const nextParam = safeInternalPath(searchParams.get('next'));
    const from = location.state?.from;
    const fromRouter =
      from?.pathname != null
        ? safeInternalPath(`${from.pathname}${from.search || ''}`)
        : null;
    return nextParam || fromRouter || '/';
  }, [location.state, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchGoogleLinkPending();
        if (!cancelled) setLinkPayload(data);
      } catch {
        if (!cancelled) setLinkPayload({ pending: false });
      } finally {
        if (!cancelled) setLinkChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const errorKey = searchParams.get('error');
    if (!errorKey) return;
    if (lastErrorToastKey.current === errorKey) return;
    lastErrorToastKey.current = errorKey;
    const msg = LOGIN_OAUTH_ERROR_MESSAGES[errorKey] || LOGIN_OAUTH_ERROR_FALLBACK;
    toast.error(msg);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('error');
    const qs = nextParams.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate, location.pathname]);

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

  const onGoogleLinkSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await completeGoogleLink({ password: linkPassword });
      dispatch(setUser(user));
      toast.success('Google sign-in linked');
      navigate(afterLoginPath);
    } catch (error) {
      toast.error(error.message || 'Could not link Google');
    } finally {
      setSubmitting(false);
    }
  };

  const onCancelGoogleLink = async () => {
    try {
      await cancelGoogleLink();
    } catch {
      toast.error('Could not cancel');
      return;
    }
    setLinkPayload({ pending: false });
    setLinkPassword('');
    navigate('/login', { replace: true });
  };

  if (!linkChecked) {
    return (
      <p className="text-sm text-sortable-text-secondary">Loading sign-in options…</p>
    );
  }

  const wantsGoogleLinkParam = searchParams.get('google_link') === '1';
  const showStaleGoogleLinkHint =
    wantsGoogleLinkParam && !linkPayload.pending && !linkPayload.expired;

  if (linkPayload.pending) {
    return (
      <form onSubmit={onGoogleLinkSubmit} className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-sortable-card/40 px-3 py-3 text-sm text-sortable-text-secondary">
          <p className="text-sortable-text-primary">
            Link Google sign-in to your existing account
          </p>
          <p className="mt-2">
            Enter the password for <span className="font-medium">{linkPayload.username}</span>{' '}
            <span className="text-sortable-text-primary">({linkPayload.email})</span> to confirm it
            is yours.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-sortable-text-secondary">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={linkPassword}
            onChange={(e) => setLinkPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <Button type="submit" disabled={submitting} size="lg" className={authCtaClass}>
          {submitting ? 'Linking…' : 'Link Google and sign in'}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onCancelGoogleLink} className={authCtaClass}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <>
      {linkPayload.expired && wantsGoogleLinkParam && (
        <p className="mb-4 rounded-xl border border-white/10 bg-sortable-card/40 px-3 py-3 text-sm text-sortable-text-secondary">
          That Google link step expired. Use <span className="font-medium">Sign in with Google</span>{' '}
          below to try again.
        </p>
      )}
      {showStaleGoogleLinkHint && (
        <p className="mb-4 rounded-xl border border-white/10 bg-sortable-card/40 px-3 py-3 text-sm text-sortable-text-secondary">
          To link Google, choose <span className="font-medium">Sign in with Google</span> first, then
          enter your password here when prompted.
        </p>
      )}
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
        <Button type="submit" disabled={submitting} size="lg" className={authCtaClass}>
          {submitting ? 'Signing in' : 'Sign in'}
        </Button>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-sortable-text-secondary">
          <div className="h-px flex-1 bg-white/10" />
          <span>or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <GoogleButton mode="signIn" className={authCtaClass} />
        <AppleButton mode="signIn" className={authCtaClass} />
      </form>
    </>
  );
}
