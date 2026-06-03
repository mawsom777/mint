importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBPeUSwg6LO2jEku63uwgrWmuZpvY42CjM",
    projectId: "mint-fire",
    messagingSenderId: "943732475005",
    appId: "1:943732475005:web:7e79a7911de41808e39d14"
});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Фоновое сообщение:', payload);
    const data = payload.data || {};

    const senderId = data.senderId;
    if (!senderId) {
        return showSimpleNotification(data);
    }

    const tag = `chat_${senderId}`;
    const senderName = data.senderName || 'Пользователь';
    const messageText = data.body || 'Новое сообщение';


    self.registration.getNotifications({ tag })
        .then(notifications => {
            let unreadCount = 1;

            if (notifications.length > 0) {
                const prevData = notifications[0].data || {};
                unreadCount = (prevData.unreadCount || 0) + 1;

                notifications.forEach(notif => notif.close());
            }

            let notificationBody;
            let notificationTitle;

            if (data['source'] === 'call') {
                notificationTitle = `${data.senderName} (звонок)`;
                notificationBody = 'Звонок';
            } else
                notificationTitle = unreadCount === 1 ? senderName : `${senderName} (${unreadCount})`;
                notificationBody = messageText;

            const options = {
                body: notificationBody,
                icon: '/imgs/icn.ico',
                badge: '/imgs/badge.png',
                vibrate: data['source'] === 'call' ? [700, 300, 700, 300, 700] : [200, 100, 200],
                tag: tag,                       
                renotify: unreadCount > 1,      
                data: {
                    ...data,
                    unreadCount: unreadCount,   
                    timestamp: Date.now()
                },
                actions: [
                    { action: 'open', title: 'Открыть чат' }
                ]
            };

            return self.registration.showNotification(notificationTitle, options);
        });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const data = event.notification.data || {};
    const urlToOpen = data.senderId
        ? `/index.html?chat=${data.senderId}`
        : '/index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url.includes('/index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(urlToOpen);
            })
    );
});

function showSimpleNotification(data) {
    const title = data.title || 'Уведомление';
    const options = {
        body: data.body || '',
        icon: '/imgs/icn.ico',
        badge: '/imgs/badge.png',
        vibrate: [200, 100, 200],
        data: data
    };
    return self.registration.showNotification(title, options);
}