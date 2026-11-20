import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/pwa';
import { routerBasename } from './lib/publicUrl';
import { AppProvider } from './store/AppContext';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
