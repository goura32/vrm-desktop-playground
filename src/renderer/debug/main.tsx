import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DebugWindow } from './DebugWindow';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugWindow />
  </StrictMode>,
);
