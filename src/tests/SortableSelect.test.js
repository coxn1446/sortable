import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SortableSelect from '../components/ui/SortableSelect';

describe('SortableSelect', () => {
  test('selects an option and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ];
    render(<SortableSelect value="a" onChange={onChange} options={options} ariaLabel="Pick" />);

    await user.click(screen.getByRole('combobox', { name: 'Pick' }));
    await user.click(screen.getByRole('option', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });

  test('closes on Escape', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SortableSelect
        value="x"
        onChange={onChange}
        options={[{ value: 'x', label: 'One' }]}
        ariaLabel="Pick"
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Pick' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('supports React node labels with optionAriaLabel', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <SortableSelect
        value="u2"
        onChange={onChange}
        ariaLabel="User"
        options={[
          {
            value: 'u1',
            label: <span>Row one</span>,
            optionAriaLabel: 'alice',
          },
          {
            value: 'u2',
            label: <span>Row two</span>,
            optionAriaLabel: 'bob',
          },
        ]}
      />
    );

    expect(screen.getByRole('combobox', { name: 'User' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'User' }));
    await user.click(screen.getByRole('option', { name: 'alice' }));
    expect(onChange).toHaveBeenCalledWith('u1');
  });
});
