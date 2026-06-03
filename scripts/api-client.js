import { tokenManager } from './token-manager.js';
import { showAuthScreen } from '/scripts/spa-router.js';

export { refreshTokenWeb }

let isRefreshing = false;
let failedQueue = [];

export function isNativePlatform() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

async function refreshTokenNative(redirect) {
    const refreshToken = await tokenManager.getRefreshToken();
    const response = await fetch(refreshPHP, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await response.json();
    if (data.error) {
        if (data.reason === 'invalid_refresh_token' && redirect)
            showAuthScreen()
        throw new Error(data.error);
    }
    await tokenManager.setAccessToken(data.access_token);
    await tokenManager.setRefreshToken(data.refresh_token);
    return data.access_token;
}

async function refreshTokenWeb() {
    const response = await fetch(refreshPHP, {
        method: 'POST',
        credentials: 'include',  
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Refresh failed');
}


export async function apiRequest(url, body = {}, redirect = true) {
    const native = isNativePlatform()
    let accessToken = native ? await tokenManager.getAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (native) {
        headers['X-Client-Type'] = 'capacitor';
    }
    if (native && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const fetchOptions = {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    };
    if (!native) {
        fetchOptions.credentials = 'include';
        delete headers['Authorization'];
    }
    
    const makeRequest = async (token) => {
        const reqHeaders = { ...headers };
        if (native && token) reqHeaders['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, {
            ...fetchOptions,
            headers: reqHeaders
        });
        const data = await res.json().catch(() => ({}));
        return { response: res, data };
    };
    
    let { response, data } = await makeRequest(native ? accessToken : null);
    
    const needAuth = data.reason === 'invalid_token' || data.authenticated === false;
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
            await new Promise((resolve, reject) => {
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