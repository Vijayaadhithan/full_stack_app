import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";
// Leaflet CSS moved to map components - lazy loaded only when needed

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

