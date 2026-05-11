import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { setUser } from '../../store/auth.reducer';
import { register } from '../../helpers/authHelpers';
import Button from '../ui/Button';

const inputClass =
  'rounded-xl border border-white/10 bg-sortable-surface px-3 py-2 text-sm text-sortable-text-primary placeholder:text-sortable-text-secondary focus:border-sortable-highlight focus:outline-none focus:ring-1 focus:ring-sortable-highlight';

export default function RegisterForm() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await register({
        username: form.username,
        password: form.password,
        email: form.email.trim(),
      });
      dispatch(setUser(user));
      toast.success('Welcome to Sortable');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Sign up failed');
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
          value={form.username}
          onChange={onChange('username')}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={onChange('password')}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sortable-text-secondary">Email (optional)</span>
        <input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={onChange('email')}
          placeholder="you@example.com"
          className={inputClass}
        />
      </label>
      <p className="text-center text-xs leading-relaxed text-sortable-text-secondary">
        By creating a profile, you agree to our{' '}
        <Link to="/privacy" className="font-medium text-sortable-highlight hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link to="/terms" className="font-medium text-sortable-highlight hover:underline">
          Terms &amp; Conditions
        </Link>
        .
      </p>
      <Button type="submit" disabled={submitting} size="lg">
        {submitting ? 'Creating account' : 'Create account'}
      </Button>
    </form>
  );
}
