export { displayIncomingCall, isDisplaying }



let isDisplaying = false

function isNativePlatform() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}
function getCallPlugin() {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.IncomingCallKit || null;
}

async function requestCallPermissions() {
    const plugin = getCallPlugin()
    if (plugin !== null) {
        await plugin.requestPermissions();
        await plugin.requestFullScreenIntentPermission();
    }
}
requestCallPermissions()


async function displayIncomingCall(callData) {
    isDisplaying = true
    const plugin = getCallPlugin()
    if (plugin !== null) {
        await plugin.showIncomingCall({
            callId: '1',
            callerName: 'abc',
            hasVideo: true, // или false, если звонок аудио
            timeoutMs: 45000,           // Таймаут через 45 секунд
            extra: {                    // Любые доп. данные, которые вернутся в колбэках
                roomId: 3,
                callerAvatar: '/imgs/camera.svg'
            },
            android: {
                channelId: 'incoming_calls',
                channelName: 'Входящий звонок',
                showFullScreen: true,
                isHighPriority: true,
                accentColor: '#128957'
            }
        });
    }
}

if (isNativePlatform()) {
    const plugin = getCallPlugin()

    plugin.addListener('callDeclined', ({call}) => {
        console.log(`Звонок ${call.callId} отклонён`);

        // Здесь ваш код, который сообщает бэкенду об отклонении звонка.
    });

    plugin.addListener('callAccepted', async ({call}) => {
        console.log(`Звонок ${call.callId} принят`);
        // Здесь ваш код, который:
        // 1. Останавливает сигнал "вызова".
        // 2. Переключает пользователя на экран звонка в вашем приложении.
        // 3. Передаёт roomId (из call.extra) в вашу WebRTC-логику для подключения к звонку.
        // ...
    });

    plugin.addListener('callTimedOut', ({call}) => {
        console.log(`Звонок ${call.callId} не был принят вовремя`);
        // Здесь ваш код для очистки состояния неотвеченного звонка на бэкенде.
    });

    plugin.addListener('callEnded', ({call}) => {
        console.log(`Звонок ${call.callId} завершён`);
        // Обработка штатного завершения звонка.
    });
}