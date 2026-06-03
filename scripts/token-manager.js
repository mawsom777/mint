export function isNativePlatform() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}

function getPreferencesPlugin() {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.Preferences || null;
}

async function setItem(key, value) {
    const plugin = getPreferencesPlugin();
    if (!plugin) return;
    try {
        await plugin.set({ key, value });
    } catch (e) {
        console.error(`setItem error [${key}]:`, e);
    }
}

async function getItem(key) {
    const plugin = getPreferencesPlugin();
    if (!plugin) return null;
    try {
        const { value } = await plugin.get({ key });
        return value;
    } catch (e) {
        console.error(`getItem error [${key}]:`, e);
        return null;
    }
}

async function removeItem(key) {
    const plugin = getPreferencesPlugin();
    if (!plugin) return;
    try {
        await plugin.remove({ key });
    } catch (e) {
        console.error(`removeItem error [${key}]:`, e);
    }
}

export const tokenManager = {
    async setAccessToken(token) {
        await setItem(ACCESS_TOKEN_KEY, token);
    },
    async getAccessToken() {
        return await getItem(ACCESS_TOKEN_KEY);
    },
    async setRefreshToken(token) {
        await setItem(REFRESH_TOKEN_KEY, token);
    },
    async getRefreshToken() {
        return await getItem(REFRESH_TOKEN_KEY);
    },
    async clearTokens() {
        await removeItem(ACCESS_TOKEN_KEY);
        await removeItem(REFRESH_TOKEN_KEY);
    },
    async logout(logoutAll = false) {
        const native = isNativePlatform();
        const refreshToken = native ? await this.getRefreshToken() : null;

        const body = {};
        if (native && refreshToken) body.refresh_token = refreshToken;
        if (logoutAll) body.logout_all = true;

        const response = await fetch(logoutPHP, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (response.ok && native) {
            await this.clearTokens();
        }
        return response.ok;
    }
};


const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';