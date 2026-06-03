import { tokenManager } from './token-manager';
import { refreshPHP, isNativePlatform as configIsNative } from './config';

let isRefreshing = false;

type QueuePromise = {
    resolve: (value: string | null) => void;
    reject: (reason?: unknown) => void;
};

let failedQueue: QueuePromise[] = [];

function processQueue(error: unknown, token: string | null = null): void {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
}

async function refreshTokenNative(redirect: boolean): Promise<string> {
    const refreshToken = await tokenManager.getRefreshToken();
    const response = await fetch(refreshPHP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await response.json();
    if (data.error) {
        if (data.reason === 'invalid_refresh_token' && redirect) {
            const { showAuthScreen } = await import('../scripts/spa-router.ts');
            showAuthScreen();
        }
        throw new Error(data.error);
    }
    await tokenManager.setAccessToken(data.access_token);
    await tokenManager.setRefreshToken(data.refresh_token);
    return data.access_token;
}

async function refreshTokenWeb(): Promise<void> {
    const response = await fetch(refreshPHP, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Refresh failed');
}

interface ApiResponse<T = unknown> {
    data: T;
    response: Response;
}

async function apiRequest<T = unknown>(url: string, body: Record<string, unknown> = {}, redirect: boolean = true): Promise<ApiResponse<T>> {
    const native = configIsNative();
    let accessToken: string | null = native ? await tokenManager.getAccessToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (native) {
        headers['X-Client-Type'] = 'capacitor';
    }
    if (native && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };
    if (!native) {
        fetchOptions.credentials = 'include';
        delete headers['Authorization'];
    }

    const makeRequest = async (token: string | null): Promise<{ response: Response; data: T }> => {
        const reqHeaders = { ...headers };
        if (native && token) reqHeaders['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, {
            ...fetchOptions,
            headers: reqHeaders
        });
        const data: T = await res.json().catch(() => ({}) as T);
        return { response: res, data };
    };

    let { response, data } = await makeRequest(native ? accessToken : null);

    type ErrorResponse = { reason?: string; authenticated?: boolean };
    const errorData = data as unknown as ErrorResponse;
    const needAuth = errorData.reason === 'invalid_token' || errorData.authenticated === false;

    if (needAuth) {
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                if (native) {
                    const newToken = await refreshTokenNative(redirect);
                    await tokenManager.setAccessToken(newToken);
                    processQueue(null, newToken);
                    const result = await makeRequest(newToken);
                    response = result.response;
                    data = result.data;
                } else {
                    await refreshTokenWeb();
                    processQueue(null, null);
                    const result = await makeRequest(null);
                    response = result.response;
                    data = result.data;
                }
            } catch (err) {
                processQueue(err, null);
                throw err;
            } finally {
                isRefreshing = false;
            }
        } else {
            await new Promise<string | null>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            });
            const newToken = native ? await tokenManager.getAccessToken() : null;
            const result = await makeRequest(newToken);
            response = result.response;
            data = result.data;
        }
    }

    return { data, response };
}

export { refreshTokenWeb, apiRequest };