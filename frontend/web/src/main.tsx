import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeApiClient } from '../../shared/api/client';

// Initialize API client (load runtime config from /config.json)
initializeApiClient()
  .then(() => {
    console.log('[App] API client initialized');
  })
  .catch((error) => {
    console.error('[App] Failed to initialize API client:', error);
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
