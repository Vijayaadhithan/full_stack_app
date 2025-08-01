import React, { useState, useEffect } from "react";
import {
  checkLocationPermission,
  requestLocationPermission,
  getCurrentPosition,
} from "@/lib/permissions";

const PermissionRequester: React.FC = () => {
  const [locationPermission, setLocationPermission] =
    useState<string>("unknown");
  const [currentCoordinates, setCurrentCoordinates] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchPermissionStatus = async () => {
      setIsLoading(true);
      const status = await checkLocationPermission();
      setLocationPermission(status);
      setIsLoading(false);
    };
    fetchPermissionStatus();
  }, []);

  const handleRequestLocation = async () => {
    setIsLoading(true);
    const status = await requestLocationPermission();
    setLocationPermission(status);
    if (status === "granted") {
      const coords = await getCurrentPosition();
      setCurrentCoordinates(coords);
    }
    setIsLoading(false);
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "16px",
        margin: "16px 0",
        borderRadius: "8px",
      }}
    >
      <h4>Location Permission Management</h4>
      <p>
        Current Location Permission Status:{" "}
        <strong>{locationPermission}</strong>
      </p>
      {locationPermission !== "granted" && (
        <button
          onClick={handleRequestLocation}
          disabled={isLoading || locationPermission === "granted"}
        >
          {isLoading ? "Processing..." : "Request Location Permission"}
        </button>
      )}
      {locationPermission === "granted" && !currentCoordinates && (
        <button
          onClick={async () => {
            setIsLoading(true);
            const coords = await getCurrentPosition();
            setCurrentCoordinates(coords);
            setIsLoading(false);
          }}
          disabled={isLoading}
        >
          {isLoading ? "Fetching..." : "Get Current Location"}
        </button>
      )}
      {currentCoordinates && (
        <div>
          <p>Current Coordinates:</p>
          <pre>{JSON.stringify(currentCoordinates, null, 2)}</pre>
        </div>
      )}
      {isLoading && <p>Loading...</p>}
    </div>
  );
};

export default PermissionRequester;
