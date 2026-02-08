import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDB } from './lib/database';

const root = createRoot(document.getElementById('root')!);

const startApp = async () => {
  await initDB();
  root.render(<App />);
};

startApp();
