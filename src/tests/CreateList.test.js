import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import CreateList from '../routes/CreateList';
import * as listHelpers from '../helpers/listHelpers';
import toast from 'react-hot-toast';

const mockNavigate = jest.fn();

jest.mock('../helpers/listHelpers');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('react-hot-toast', () => ({ error: jest.fn(), success: jest.fn() }));

jest.mock('@ionic/react', () => ({ setupIonicReact: () => {} }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe('CreateList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listHelpers.createList.mockResolvedValue({ list: { list_id: 42 } });
  });

  test('does not surface collaboration mode choices', () => {
    render(
      <MemoryRouter future={routerFutureFlags}>
        <CreateList />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Collaboration mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Everyone votes into one shared ranking/i)).not.toBeInTheDocument();
  });

  test('shows the public list checkbox', () => {
    render(
      <MemoryRouter future={routerFutureFlags}>
        <CreateList />
      </MemoryRouter>
    );

    expect(screen.getByRole('checkbox', { name: /Public list/i })).toBeInTheDocument();
  });

  test('submits createList with title, items, and isPublic only', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={routerFutureFlags}>
        <CreateList />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Best pizza toppings'), 'Toppings');
    await user.type(screen.getByPlaceholderText(/Pepperoni/i), 'A\nB\nC');
    await user.click(screen.getByRole('checkbox', { name: /Public list/i }));

    await user.click(screen.getByRole('button', { name: 'Create list' }));

    await waitFor(() => {
      expect(listHelpers.createList).toHaveBeenCalledTimes(1);
    });

    const payload = listHelpers.createList.mock.calls[0][0];
    expect(payload).toEqual({
      title: 'Toppings',
      description: '',
      items: ['A', 'B', 'C'],
      isPublic: true,
    });
    expect(payload).not.toHaveProperty('collabMode');
    expect(payload).not.toHaveProperty('collab_mode');
  });

  test('does not submit when fewer than two items', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={routerFutureFlags}>
        <CreateList />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Best pizza toppings'), 'One');
    await user.type(screen.getByPlaceholderText(/Pepperoni/i), 'OnlyOne');
    await user.click(screen.getByRole('button', { name: 'Create list' }));

    expect(listHelpers.createList).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Add at least 2 items.');
  });
});
