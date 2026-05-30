import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById("root")!;

// If the page was prerendered (react-snap / SSG), #root already contains markup,
// so hydrate it. Otherwise mount fresh. #root is intentionally empty in
// index.html (the no-JS fallback lives in a sibling <noscript>).
if (container.hasChildNodes()) {
  hydrateRoot(container, <App />);
} else {
  createRoot(container).render(<App />);
}
