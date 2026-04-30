import { createRoot } from 'react-dom/client';
import { Options } from './Options';

const rootElement = document.getElementById('options-root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<Options />);
}
