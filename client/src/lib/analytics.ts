import { onCLS, onLCP, onTTFB, onFCP, onINP, type Metric } from 'web-vitals';

const VITALS_URL = '/api/performance-metrics';

function sendToAnalytics(metric: Metric) {
    // Use a minimal payload to avoid serialization issues and large payloads
    const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        page: window.location.pathname,
        timestamp: Date.now(),
        details: {
            id: metric.id,
            navigationType: metric.navigationType,
            delta: metric.delta,
        },
    });

    // Always use fetch with keepalive for better observability and error handling
    fetch(VITALS_URL, {
        body,
        method: 'POST',
        keepalive: true,
        headers: {
            'Content-Type': 'application/json',
        },
    })
        .then((res) => {
            if (!res.ok) {
                console.error(`[Analytics] Metric ${metric.name} failed with status ${res.status}`);
            }
        })
        .catch((err) => console.error('Failed to send performance metric:', err));
}

export function reportWebVitals() {
    try {
        onCLS(sendToAnalytics);
        onLCP(sendToAnalytics);
        onTTFB(sendToAnalytics);
        onFCP(sendToAnalytics);
        onINP(sendToAnalytics);
    } catch (err) {
        console.error('Failed to initialize web-vitals:', err);
    }
}
