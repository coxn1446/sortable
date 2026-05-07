import React from 'react';
import { render, screen, within } from '@testing-library/react';
import RankedList from '../components/ui/RankedList';

describe('RankedList', () => {
  test('renders items in rank order with list semantics', () => {
    const items = [
      { id: '1', label: 'First' },
      { id: '2', label: 'Second' },
    ];

    render(<RankedList items={items} />);

    const list = screen.getByRole('list');
    const li = within(list).getAllByRole('listitem');
    expect(li).toHaveLength(2);
    expect(li[0]).toHaveTextContent(/1/);
    expect(li[0]).toHaveTextContent(/First/);
    expect(li[1]).toHaveTextContent(/2/);
    expect(li[1]).toHaveTextContent(/Second/);
  });

  test('returns null when items is empty', () => {
    const { container } = render(<RankedList items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
