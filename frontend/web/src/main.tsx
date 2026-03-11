import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeApiClient } from '../../shared/api/client';

// Initialize API client (load runtime config from /config.json)
// CRITICAL: Must complete before rendering app to avoid URL construction errors
initializeApiClient()
  .then(() => {
    console.log('[App] API client initialized, rendering app...');
    
    // Render app only after API client is initialized
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((error) => {
    console.error('[App] Failed to initialize API client:', error);
    
    // Still render app even if config loading fails (will use fallback URL)
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
