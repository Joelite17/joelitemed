import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AccountsProvider } from './context/AccountsContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <AccountsProvider>
        <App />
      </AccountsProvider>
    </NotificationProvider>
  </StrictMode>
);