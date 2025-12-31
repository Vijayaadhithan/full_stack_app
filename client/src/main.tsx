import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { reportWebVitals } from "./lib/analytics";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Initialize performance monitoring
reportWebVitals();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
