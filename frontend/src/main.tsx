import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '96960694156-pg7m1cjdqas9nelo83nicrq4ig3kuq3l.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={clientId}>
          <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
