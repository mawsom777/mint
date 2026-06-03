import { logoutPHP } from './config';

export function isNativePlatform(): boolean {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}

function getPreferencesPlugin(): CapacitorPreferencesPlugin | null {
    if (!isNativePlatform()) return null;
    return window.Capacitor?.Plugins?.Preferences || null;
}

interface CapacitorPreferencesPlugin {
    set(options: { key: string; value: string }): Promise<void>;
    get(options: { key: string }): Promise<{ value: string | null }>;
    remove(options: { key: string }): Promise<void>;
}

async function setItem(key: string, value: string): Promise<void> {
    const plugin = getPreferencesPlugin();
    if (!plugin) return;
    try {
        await plugin.set({ key, value });
    } catch (e) {
        console.error(`setItem error [${key}]:`, e);
    }
}

async function getItem(key: string): Promise<string | null> {
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

async function removeItem(key: string): Promise<void> {
    const plugin = getPreferencesPlugin();
    if (!plugin) return;
    try {
        await plugin.remove({ key });
    } catch (e) {
        console.error(`removeItem error [${key}]:`, e);
    }
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenManager = {
    async setAccessToken(token: string): Promise<void> {
        await setItem(ACCESS_TOKEN_KEY, token);
    },
    async getAccessToken(): Promise<string | null> {
        return await getItem(ACCESS_TOKEN_KEY);
    },
    async setRefreshToken(token: string): Promise<void> {
        await setItem(REFRESH_TOKEN_KEY, token);
    },
    async getRefreshToken(): Promise<string | null> {
        return await getItem(REFRESH_TOKEN_KEY);
    },
    async clearTokens(): Promise<void> {
        await removeItem(ACCESS_TOKEN_KEY);
        await removeItem(REFRESH_TOKEN_KEY);
    },
    async logout(logoutAll: boolean = false): Promise<boolean> {
        const native = isNativePlatform();
        const refreshToken = native ? await this.getRefreshToken() : null;

        const body: Record<string, unknown> = {};
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