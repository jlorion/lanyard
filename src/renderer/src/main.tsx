import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-400-italic.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-900.css';
import './styles/index.css';
import { applyTheme, storedTheme } from './lib/theme';
import { App } from './App';

// Apply the theme before the first paint to avoid a light/dark flash.
applyTheme(storedTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
