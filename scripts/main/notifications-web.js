import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging.js";
import { apiRequest } from '/scripts/api-client.js';
import { MobileNavigation } from '/scripts/main/main.js';

export { initWebNotifications }

const firebaseConfig = {
    apiKey: "AIzaSyBPeUSwg6LO2jEku63uwgrWmuZpvY42CjM",
    authDomain: "mint-fire.firebaseapp.com",
    projectId: "mint-fire",
    storageBucket: "mint-fire.firebasestorage.app",
    messagingSenderId: "943732475005",
    appId: "1:943732475005:web:7e79a7911de41808e39d14"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

async function getRegistrationToken() {
    try {
        const vapidKey = "BOt4tUm8u-nL-pXgJB6CodRyIcg_MLgUGjuuFk0nSXMxVBBiGmaLtilYf6f8TBVCw8zjC5P0lYTVpz53j-ZzLEw";

        let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!registration) {
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            registration = await navigator.serviceWorker.ready;
        }

        const currentToken = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration
        });

        if (currentToken) {
            return currentToken;
        } else {
            console.warn('Не удалось получить токен.');
            return null;
        }
    } catch (error) {
        console.error('Ошибка получения токена:', error);
        return null;
    }
}

async function sendTokenToServer(token) {
    const sendToken = await apiRequest(saveTokenPHP, {token: token, platform: 'web'});
    if (sendToken['response'].status !== 200) {
        console.log('Не отправился токен уведомлений');
    }
}

async function isTokenInDB(token) {
    const response = await apiRequest(checkTokenPHP, {token: token});
    if (response['response'].status === 200) {
        const result = response['data'];
        return result.length !== 0;
    }
    return false;
}

async function initWebNotifications() {
    const notifyBtn = document.querySelector('.notification');

    if (Notification.permission !== 'granted') {
        if (MobileNavigation.isMobile) {
            notifyBtn.style.width = '100%';
            notifyBtn.style.borderRadius = '0';
        }
        notifyBtn.style.display = 'block';
        notifyBtn.textContent = 'Включить уведомления';

        notifyBtn.onclick = async () => {
            notifyBtn.textContent = 'Ждем разрешения...';
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                notifyBtn.textContent = 'Готово!';
                const token = await getRegistrationToken();
                if (token) {
                    await sendTokenToServer(token);
                }
                notifyBtn.classList.add('hide');
                setTimeout(() => {
                    notifyBtn.style.display = 'none';
                }, 500);
            } else {
                notifyBtn.textContent = 'Разрешение не получено';
            }
        };
    } else {
        const token = await getRegistrationToken();
        if (token) {
            const exists = await isTokenInDB(token);
            if (!exists) {
                await sendTokenToServer(token);
            }
        }
        notifyBtn.style.display = 'none';
    }
}
