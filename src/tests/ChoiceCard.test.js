import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ChoiceCard from '../components/ui/ChoiceCard';

describe('ChoiceCard', () => {
  test('renders default exclude label when onExclude provided', async () => {
    const user = userEvent.setup();
    const onExclude = jest.fn();

    render(
      <ChoiceCard item={{ item_id: 1, label: 'Alpha' }} onSelect={() => {}} onExclude={onExclude} />
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onExclude).toHaveBeenCalledTimes(1);
    expect(onExclude).toHaveBeenCalledWith(expect.objectContaining({ label: 'Alpha' }));
  });

  test('renders custom exclude label text', async () => {
    const user = userEvent.setup();
    const onExclude = jest.fn();

    render(
      <ChoiceCard
        item={{ item_id: 1, label: 'Alpha' }}
        onSelect={() => {}}
        onExclude={onExclude}
        excludeLabel="Never seen it!"
      />
    );

    await user.click(screen.getByRole('button', { name: /Never seen it/i }));
    expect(onExclude).toHaveBeenCalledTimes(1);
  });

  test('disable exclude action when excludeDisabled', () => {
    render(
      <ChoiceCard
        item={{ item_id: 1, label: 'Alpha' }}
        onSelect={() => {}}
        onExclude={() => {}}
        excludeDisabled
      />
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });

  test('without photo shows centered title only (no decorative placeholder)', () => {
    const { container } = render(
      <ChoiceCard item={{ item_id: 1, label: 'Plain title' }} onSelect={() => {}} />
    );

    expect(screen.getAllByText('Plain title')).toHaveLength(1);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.bg-sortable-gradient')).toBeNull();
  });

  test('with photo shows title and image below', () => {
    const { container } = render(
      <ChoiceCard
        item={{
          item_id: 1,
          label: 'With pic',
          image_url: 'https://example.com/p.jpg',
        }}
        onSelect={() => {}}
      />
    );

    expect(screen.getAllByText('With pic')).toHaveLength(1);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg');
  });
});
