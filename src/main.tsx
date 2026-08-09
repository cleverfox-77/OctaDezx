import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById("root")!;

// #root ships with the crawler fallback markup from index.html (or, per route,
// from scripts/prerender.mjs). That markup is plain HTML, not a React render, so
// it must NOT be hydrated: hydrateRoot would mismatch every node. createRoot()
// clears the container on first render, which is exactly what we want.
createRoot(container).render(<App />);
