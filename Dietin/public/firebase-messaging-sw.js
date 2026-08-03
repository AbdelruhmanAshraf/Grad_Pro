/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

// IMPORTANT: Keep in sync with src/lib/firebase.ts
// Service workers cannot read Vite env vars; the Firebase Web SDK config
// below is public (it identifies the project — security is enforced by
// Firestore/Storage rules, not by hiding this config).
firebase.initializeApp({
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Dietin'
  const options = {
    body: payload.notification?.body,
    icon: '/11.png',
    data: payload.data || {},
    badge: '/11.png',
  }
  self.registration.showNotification(title, options)
})
