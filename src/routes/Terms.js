import React from 'react';
import { Link } from 'react-router-dom';

import {
  LEGAL_BOILERPLATE_EFFECTIVE_NOTICE,
  TermsPolicySections,
} from '../legal/policyDocuments';

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-sortable-text-primary sm:text-4xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-3 text-sm text-sortable-text-secondary">{LEGAL_BOILERPLATE_EFFECTIVE_NOTICE}</p>

      <div className="mt-10">
        <TermsPolicySections />
      </div>

      <p className="mt-12 text-sm">
        <Link to="/privacy" className="font-semibold text-sortable-highlight hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
