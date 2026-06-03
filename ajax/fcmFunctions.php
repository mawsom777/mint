<?php
function getAccessToken($serviceAccountPath, $redis) {
    $cacheKey = 'fcm_access_token';
    $cached = $redis->get($cacheKey);
    if ($cached) {
        return $cached;
    }

    $credentials = json_decode(file_get_contents($serviceAccountPath), true);
    $jwt = createJWT($credentials);

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion'  => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($httpCode !== 200) {
        throw new Exception('Не удалось получить Access Token');
    }

    $data = json_decode($response, true);
    $accessToken = $data['access_token'];
    $expiresIn = $data['expires_in'] - 60;

    $redis->setex($cacheKey, $expiresIn, $accessToken);

    return $accessToken;
}

function createJWT($credentials) {
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $payload = json_encode([
        'iss'   => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => time(),
        'exp'   => time() + 3600
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    $signature = '';
    openssl_sign($base64UrlHeader . '.' . $base64UrlPayload, $signature, $credentials['private_key'], OPENSSL_ALGO_SHA256);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . '.' . $base64UrlPayload . '.' . $base64UrlSignature;
}


function sendPush($accessToken, $projectId, $token, $title, $body, $senderId = 'default', $data = [], $platform = 'web', $isCall = false) {
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";

    $messageData = array_merge($data, [
        'title'     => $title,
        'body'      => $body,
        'senderId'  => (string) $senderId,
        'senderName'=> $title
    ]);

    if ($isCall) {
        $messageData['source'] = 'call';
    }

    $message = [
        'message' => [
            'token' => $token,
            'data' => (object) $messageData
        ]
    ];

    if ($platform === 'web') {
        $message['message']['webpush'] = [
            'notification' => [
                'badge' => 'https://mint.cloudpub.ru/imgs/badge.png'
            ],
            'fcm_options' => [
                'link' => 'https://mint.cloudpub.ru/index.html?chat_id=' . $senderId
            ]
        ];
    }

    if ($platform === 'android') {
        $androidPayload = [
            'priority' => 'high',
            'ttl' => $isCall ? '30s' : '86400s',
        ];

        $androidPayload['notification'] = [
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'channel_id' => $isCall ? 'incoming_calls' : 'general_messages',
            'icon' => 'ico',
            'color' => '#2C3E50'
        ];

        if ($isCall) {
            $androidPayload['notification']['tag'] = 'call';
            $androidPayload['priority'] = 'high';
        }

        $message['message']['android'] = $androidPayload;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($message));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    return ['code' => $httpCode, 'response' => $response];
}