import React from 'react';

import CreateListForm from '../components/lists/CreateListForm';

export default function CreateList() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      <div>
        <h1 className="font-display text-3xl font-semibold text-sortable-text-primary">Create a list</h1>
        <p className="mt-1 text-sm text-sortable-text-secondary">
          Add at least two things to compare. You can keep adding more later.
        </p>
      </div>
      <CreateListForm />
    </div>
  );
}
