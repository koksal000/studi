// Import Firebase SDKs using the new major version
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCOSV6WbtG54nkNrcBipUjg8WwspbgR_6U",
    authDomain: "amlca-village-connect.firebaseapp.com",
    projectId: "amlca-village-connect",
    storageBucket: "amlca-village-connect.firebasestorage.app",
    messagingSenderId: "449359458698",
    appId: "1:449359458698:web:1bfd5fcd7fdc2470a49873",
    measurementId: "G-N6EZCZXND2"
};
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  const notificationTitle = payload.notification?.title || "Yeni Bildirim";
  const notificationOptions = {
    body: payload.notification?.body || "Yeni bir mesajınız var.",
    icon: '/images/logo.png', // Ensure this icon exists in public/images
    // data: payload.data // You can pass data to the notification click handler
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  event.notification.close();

  // Example: Open the app or a specific URL
  // You can customize this based on payload.data if you send it
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || self.location.origin; // Use environment variable or fallback
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow(appUrl + '/announcements'); // Default to announcements page
    })
  );
});
