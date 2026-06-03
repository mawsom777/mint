import { apiRequest } from '/scripts/api-client.js';
import { displayIncomingCall } from "./capacitor-call-android";

export { initAndroidNotifications }

async function initAndroidNotifications(callback) {
    const PushNotifications = window.Capacitor?.Plugins?.PushNotifications || null;
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications || null;

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
        if (permStatus.receive !== 'granted') {
            console.log('Разрешения на уведомления не получены');
            return;
        }
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
        console.log('FCM токен Android:', token.value);
        await apiRequest(saveTokenPHP, { token: token.value, platform: 'android' });
    });

    PushNotifications.addListener('registrationError', (err) => {
        console.error('Ошибка регистрации FCM:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        console.log('Push получен (foreground):', notification);
        const data = notification.data;

        console.log('Получил уведомлялку: ', data)
        if (data?.source === 'call') {
            await displayIncomingCall()
        } else {
            await LocalNotifications.schedule({
                notifications: [{
                    id: Date.now(),
                    title: data.title || notification.title,
                    body: data.body || notification.body,
                    extra: data,
                    sound: 'default',
                }]
            });
        }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
        const data = notification.notification.data;
        console.log('Клик по уведомлению:', data);

        if (data?.source === 'call') {
            displayIncomingCall()
        } else if (data?.senderId) {
            window.location.href = `/index.html?chat_id=${data.senderId}`;
        }
    });
}