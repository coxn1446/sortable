import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/Auth/LoginForm';
import Card from '../components/ui/Card';

export default function Login() {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Card className="flex flex-col gap-5 p-6 sm:p-8">
          <header>
            <h1 className="font-display text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-sortable-text-secondary">
              Welcome back to Sortable.
            </p>
          </header>
          <LoginForm />
          <p className="text-sm text-sortable-text-secondary">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-sortable-highlight hover:underline">
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
