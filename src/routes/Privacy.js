import React from 'react';
import { Link } from 'react-router-dom';

import {
  LEGAL_BOILERPLATE_EFFECTIVE_NOTICE,
  PrivacyPolicySections,
} from '../legal/policyDocuments';

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-sortable-text-primary sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-sortable-text-secondary">{LEGAL_BOILERPLATE_EFFECTIVE_NOTICE}</p>

      <div className="mt-10">
        <PrivacyPolicySections />
      </div>

      <p className="mt-12 text-sm">
        <Link to="/terms" className="font-semibold text-sortable-highlight hover:underline">
          Terms &amp; Conditions
        </Link>
      </p>
    </div>
  );
}
