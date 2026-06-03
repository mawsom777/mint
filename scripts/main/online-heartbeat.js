import { apiRequest } from '/scripts/api-client.js';
import { messages, viewObserver } from '/scripts/main/main.js';

export { userOnline }

let heartbeatInterval = null;
let userOnline = true

async function sendHeartbeat() {
    await apiRequest(markOnlinePHP)
}

function startHeartbeat() {
    userOnline = true
    if (messages.length > 0) {
        for (let i = messages.length-1; i > 0; i--) {
            const message = messages[i]
            if (message.sender !== -1 && !message.isRead) {
                viewObserver.observe(document.querySelector(`[data-message-id="${message.id}"]`))
            } else {
                break
            }
        }
    }
    if (heartbeatInterval) return;
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, 2000);
}

function stopHeartbeat() {
    userOnline = false
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            startHeartbeat();
        } else {
            stopHeartbeat();
        }
    });


    window.addEventListener('focus', startHeartbeat);
    window.addEventListener('blur', stopHeartbeat);

    if (!document.hidden && document.hasFocus()) {
        startHeartbeat();
    }
})