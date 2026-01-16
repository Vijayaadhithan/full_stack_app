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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'DoorStep';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: payload.data?.type || 'notification',
        data: payload.data || {},
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
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);

    event.notification.close();

    // Get the notification data
    const data = event.notification.data || {};
    const type = data.type;
    const relatedId = data.relatedId;

    // Determine which URL to open based on notification type
    let urlToOpen = '/notifications';

    if (type === 'booking' || type === 'booking_request' || type === 'service') {
        if (relatedId) {
            urlToOpen = `/bookings/${relatedId}`;
        } else {
            urlToOpen = '/bookings';
        }
    } else if (type === 'order') {
        if (relatedId) {
            urlToOpen = `/orders/${relatedId}`;
        } else {
            urlToOpen = '/orders';
        }
    }

    // Open the appropriate URL
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if ('focus' in client) {
                        return client.focus().then(() => client.navigate(urlToOpen));
                    }
                }
                // If no window is open, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
