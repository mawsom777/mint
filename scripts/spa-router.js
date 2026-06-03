import { apiRequest } from '/scripts/api-client.js';
import { tokenManager } from '/scripts/token-manager.js';

let isMessengerInitialized = false;
let initPromise = null;

export function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('app-screen').style.display = 'none';
    history.pushState({ screen: 'auth' }, '', '/');
}

export async function showAppScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';

    if (!isMessengerInitialized) {
        if (!initPromise) {
            initPromise = initializeMessenger();
        }
        await initPromise;
        isMessengerInitialized = true;
    }
}

async function initializeMessenger() {
    const loggedIn = (await apiRequest(isLoggedPHP, {}))['data'];
    if (!loggedIn['authenticated']) {
        showAuthScreen();
        throw new Error('Not authenticated');
    }
    window.userId = loggedIn['user_id'];
    window.name = loggedIn['name'];

    const chatsData = (await apiRequest(mainChatsPHP, {}))['data'];
    window.chats = chatsData.chats || []

    const { chatsUI, openChatFromUrl, connectSSE } = await import('/scripts/main/main.js');
    await chatsUI();
    openChatFromUrl();

    connectSSE();

    const { initFirebaseNotifications } = await import('/scripts/main/notifications.js');
    initFirebaseNotifications();
}


(async function init() {
    const loggedIn = (await apiRequest(isLoggedPHP, {}))['data'];
    if (loggedIn['authenticated']) {
        await showAppScreen();
    } else {
        showAuthScreen();
    }
})();

window.addEventListener('popstate', (event) => {
    const state = event.state;
    if (state && state.screen === 'app') {
        showAppScreen();
    } else {
        showAuthScreen();
    }
});