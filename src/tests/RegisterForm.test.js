import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import RegisterForm from '../components/Auth/RegisterForm';
import authReducer from '../store/auth.reducer';
import { register } from '../helpers/authHelpers';

jest.mock('../helpers/authHelpers', () => ({
  register: jest.fn(() =>
    Promise.resolve({
      user_id: 1,
      username: 'testuser',
      email: null,
      profile_picture: null,
      privacy_policy_agreed: true,
      terms_agreed: true,
      created_at: '',
      updated_at: '',
    })
  ),
}));

jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderRegisterForm() {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: { user: null, isAuthenticated: false, loading: false },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter future={routerFutureFlags}>
        <RegisterForm />
      </MemoryRouter>
    </Provider>
  );
}

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lists username, password, and registration policy notice (no email field)', () => {
    const { container } = renderRegisterForm();

    const labels = container.querySelectorAll('label');
    expect(labels).toHaveLength(2);
    expect(labels[0]).toHaveTextContent('Username');
    expect(labels[1]).toHaveTextContent('Password');

    expect(screen.getByText(/by creating a profile/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Privacy Policy$/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /^Terms & Conditions$/i })).toHaveAttribute('href', '/terms');
  });

  test('submits username and password only', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    await user.type(screen.getByLabelText(/^username$/i), 'myuser');
    await user.type(screen.getByLabelText(/^password$/i), 'password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(register).toHaveBeenCalledWith({
      username: 'myuser',
      password: 'password1',
    });
  });
});
