import { apiRequest } from '/scripts/api-client.js';
import { initWebNotifications } from '/scripts/main/notifications-web.js';
import { initAndroidNotifications } from '/scripts/main/notifications-android.js';
import { showAuthScreen } from "/scripts/spa-router.js";

function isNativePlatform() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}

export async function initFirebaseNotifications() {
    if (isNativePlatform()) {
        initAndroidNotifications()
    } else
        initWebNotifications()
}