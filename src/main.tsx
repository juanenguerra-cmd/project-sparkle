import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDB } from './lib/database';
import { initBrowserCompatibility, detectBrowser, testLocalStorage } from './lib/browserCompat';

const root = createRoot(document.getElementById('root')!);


initBrowserCompatibility();

const browserInfo = detectBrowser();
if (!browserInfo.isSupported) {
  console.warn('Unsupported browser detected');
  alert('Your browser may not be fully supported. Please use the latest version of Chrome, Firefox, Edge, or Safari for the best experience.');
}

if (!testLocalStorage()) {
  alert('localStorage is not available. The application may not function correctly. Please check your browser settings.');
}

const startApp = async () => {
  await initDB();
  root.render(<App />);
};

startApp();
