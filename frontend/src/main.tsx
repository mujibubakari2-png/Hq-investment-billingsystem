import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App'

// Only initialize Google OAuth when a valid Client ID is provided.
// Without this guard, GoogleOAuthProvider fires an origin_mismatch error
// for every page load when the Client ID is missing or unconfigured.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const isGoogleConfigured = !!googleClientId && googleClientId.length > 20;

const AppTree = (
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

createRoot(document.getElementById('root')!).render(
  isGoogleConfigured
    ? (
        <StrictMode>
          <ErrorBoundary>
            <GoogleOAuthProvider clientId={googleClientId!}>
              <App />
            </GoogleOAuthProvider>
          </ErrorBoundary>
        </StrictMode>
      )
    : AppTree
);
