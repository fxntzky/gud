import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ControlRoom } from './components/ControlRoom';
import './styles/reset.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === '/control' ? <ControlRoom /> : <App />}
  </StrictMode>,
);
