import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-400-italic.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-900.css';
import './styles/index.css';
import { applyAccent, applyTheme, detectPlatform, storedAccent, storedTheme } from './lib/appearance';
import { App } from './App';

// Apply theme and accent before the first paint to avoid a flash of the defaults.
document.documentElement.dataset.platform = detectPlatform();
applyTheme(storedTheme());
applyAccent(storedAccent());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
