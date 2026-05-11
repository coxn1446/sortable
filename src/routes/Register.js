import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '../components/Auth/RegisterForm';
import Card from '../components/ui/Card';
import GoogleButton from '../components/Auth/GoogleButton';
import AppleButton from '../components/Auth/AppleButton';

const authCtaClass = 'w-full md:max-w-auth-cta md:self-center';

export default function Register() {
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Card className="flex flex-col gap-5 p-6 sm:p-8">
          <header>
            <h1 className="font-display text-2xl font-semibold">Create an account</h1>
            <p className="mt-1 text-sm text-sortable-text-secondary">
              Get started with Sortable.
            </p>
          </header>
          <div className="flex flex-col gap-4">
            <RegisterForm />
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-sortable-text-secondary">
              <div className="h-px flex-1 bg-white/10" />
              <span>or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <GoogleButton mode="signUp" className={authCtaClass} />
            <AppleButton mode="signUp" className={authCtaClass} />
          </div>
          <p className="text-sm text-sortable-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-sortable-highlight hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
