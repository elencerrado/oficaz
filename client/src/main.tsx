import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Performance optimization - mark body as loaded to prevent FOUC
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
});

createRoot(document.getElementById("root")!).render(<App />);
