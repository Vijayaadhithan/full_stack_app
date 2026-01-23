/* eslint-env serviceworker */
/* global firebase */

// Firebase Messaging Service Worker
// This handles push notifications when the web app is in the background

// Import Firebase scripts for messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase with your config
// These values are replaced at build time or use defaults
firebase.initializeApp({
    apiKey: "AIzaSyDs4MJm55Aelkvfgh4cC9Yj6KHbyK-yFdY",
    authDomain: "vaasal-d888a.firebaseapp.com",
    projectId: "vaasal-d888a",
    storageBucket: "vaasal-d888a.firebasestorage.app",
    messagingSenderId: "490481415278",
    appId: "1:490481415278:web:92e6ac583ad95eb7d3627f"
});

// Get messaging instance
const messaging = firebase.messaging();

const isDebug = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/.test(
    self.location.hostname,
);

const debugLog = (...args) => {
    if (isDebug) {
        console.log(...args);
    }
};

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    debugLog("[firebase-messaging-sw.js] Received background message:", payload);
    console.info("[firebase-messaging-sw.js] Payload summary", {
        type: payload.data?.type,
        relatedId: payload.data?.relatedId,
        hasTitle: Boolean(payload.notification?.title || payload.data?.title),
        hasBody: Boolean(payload.notification?.body || payload.data?.body),
    });

    const notificationTitle =
        payload.notification?.title ||
        payload.data?.title ||
        'DoorStep';
    const notificationBody = payload.notification?.body || payload.data?.body || '';
    const notificationData = {
        ...(payload.data || {}),
        title: payload.data?.title || notificationTitle,
        body: payload.data?.body || notificationBody,
    };

    const notificationOptions = {
        body: notificationBody,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.data?.type || 'notification',
        data: notificationData,
        actions: [
            {
                action: 'open',
                title: 'Open'
            }
        ],
        requireInteraction: true
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    debugLog("[firebase-messaging-sw.js] Notification clicked:", event);

    event.notification.close();

    // Get the notification data
    const data = event.notification.data || {};

    const params = new URLSearchParams();
    if (data.type) params.set('type', data.type);
    if (data.title) params.set('title', data.title);
    if (data.body) params.set('message', data.body);
    if (data.relatedId) params.set('relatedId', data.relatedId);
    if (data.clickUrl) params.set('clickUrl', data.clickUrl);

    let urlToOpen = `/notification/redirect${params.toString() ? `?${params.toString()}` : ''}`;

    // Make sure URL is absolute
    if (urlToOpen.startsWith('/')) {
        urlToOpen = self.registration.scope.replace(/\/$/, '') + urlToOpen;
    }

    debugLog("[firebase-messaging-sw.js] Opening URL:", urlToOpen);

    // Open the appropriate URL
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    // Check if the client URL is the same origin
                    if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
                        return client.focus().then((focusedClient) => {
                            // Navigate to the notification URL
                            if (focusedClient.navigate) {
                                return focusedClient.navigate(urlToOpen);
                            }
                            // Fallback: post message to client to navigate
                            focusedClient.postMessage({
                                type: 'NOTIFICATION_CLICK',
                                url: urlToOpen
                            });
                            return focusedClient;
                        });
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
