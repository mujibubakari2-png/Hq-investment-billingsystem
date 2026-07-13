import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '../pages/Login';
import { authApi } from '../api/authApi';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <div data-testid="google-login" />,
}));

vi.mock('../api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    googleLogin: vi.fn(),
    mfaVerify: vi.fn(),
  },
  isMfaChallenge: vi.fn(() => false),
}));

vi.mock('../stores/authStore', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    useAuth: () => ({ user: null }),
  },
}));

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and blocks submission when the email is invalid', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/mujibu@gmail.com/i), {
      target: { value: 'not-an-email' },
    });
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });
});
