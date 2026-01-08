import React, { useState, useEffect } from "react";

/**
 * Permission Requester Component - Web-only version
 * Uses standard browser Geolocation API instead of Capacitor
 */
const PermissionRequester: React.FC = () => {
  const showDebugUi =
    import.meta.env.DEV ||
    `${import.meta.env.VITE_ENABLE_PERMISSION_DEBUG ?? ""}`.toLowerCase() ===
    "true";

  // Hooks MUST be called before any conditional returns
  const [locationPermission, setLocationPermission] =
    useState<string>("unknown");
  const [currentCoordinates, setCurrentCoordinates] = useState<GeolocationCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip effect logic if not showing debug UI
    if (!showDebugUi) return;

    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationPermission("unsupported");
      return;
    }

    // Check permission state if available
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setLocationPermission(result.state);
        result.addEventListener("change", () => {
          setLocationPermission(result.state);
        });
      }).catch(() => {
        setLocationPermission("unknown");
      });
    }
  }, [showDebugUi]);

  // Only show in development mode - return AFTER all hooks
  if (!showDebugUi) {
    return null;
  }

  const handleRequestLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoordinates(position.coords);
        setLocationPermission("granted");
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setLocationPermission(err.code === 1 ? "denied" : "error");
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "16px",
        margin: "16px 0",
        borderRadius: "8px",
        backgroundColor: "#f5f5f5",
      }}
    >
      <h4>📍 Location Permission (Debug)</h4>
      <p>
        Status: <strong>{locationPermission}</strong>
      </p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {locationPermission !== "granted" && (
        <button
          onClick={handleRequestLocation}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Processing..." : "Request Location Permission"}
        </button>
      )}

      {locationPermission === "granted" && !currentCoordinates && (
        <button
          onClick={handleRequestLocation}
          disabled={isLoading}
          style={{ padding: "8px 16px" }}
        >
          {isLoading ? "Fetching..." : "Get Current Location"}
        </button>
      )}

      {currentCoordinates && (
        <div style={{ marginTop: "12px" }}>
          <p><strong>Current Coordinates:</strong></p>
          <pre style={{ background: "#e0e0e0", padding: "8px", borderRadius: "4px" }}>
            Latitude: {currentCoordinates.latitude}
            Longitude: {currentCoordinates.longitude}
            Accuracy: {currentCoordinates.accuracy}m
          </pre>
        </div>
      )}

      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default PermissionRequester;
