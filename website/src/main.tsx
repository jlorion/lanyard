import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './styles/global.css';
import './styles/docs.css';
import { App } from './App';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Pre-rendered pages are hydrated; `vite dev` serves an empty shell instead.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
