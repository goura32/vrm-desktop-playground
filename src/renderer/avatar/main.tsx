import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AvatarWindow } from './AvatarWindow';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AvatarWindow />
  </StrictMode>,
);
