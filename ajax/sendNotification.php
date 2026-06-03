<?php
require_once 'fcmFunctions.php';
require_once 'config.php';
require_once 'tokensJWT.php';
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$recipientId = $data['recipient_id'];
$body = $data['body'];
$data = $data['data'] ?? [];
if (!$recipientId) {
    echo json_encode(['success' => false, 'error' => 'No recipient']);
    exit;
}

$accessToken = getAccessTokenFromRequest();
if (!$accessToken || $accessToken === 'undefined') {
    http_response_code(200);
    echo json_encode(['authenticated' => false]);
    exit;
}
$payload = verifyAccessToken($accessToken);
if (!$payload) {
    http_response_code(200);
    echo json_encode(['authenticated' => false, 'reason' => 'invalid_token']);
    exit;
}

$groupId = (string) $payload['user_id'];
$title = $payload['name'];

define("SERVICE_ACCOUNT_PATH", config('firebase.service_account_path'));

try {
    $redis = getRedisConnection();
    $accessToken = getAccessToken(SERVICE_ACCOUNT_PATH, $redis);
    $projectId = 'mint-fire';


    $redis = getRedisConnection();
    $pdoChecker = getDBCheckerConnection();
    $pdoWriter = getDBWriterConnection();

    $stmt = $pdoChecker->prepare("SELECT token, platform FROM fcm_tokens WHERE account_id = ? AND is_active = 1");
    $stmt->execute([$recipientId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($rows)) {
        echo json_encode(['success' => false, 'error' => 'No active tokens']);
        exit;
    }

    $successCount = 0;
    foreach ($rows as $row) {
        $result = sendPush(
            $accessToken,
            $projectId,
            $row['token'],
            $title,
            $body,
            $groupId,
            $data,
            $row['platform'],
            isset($data['source']) && $data['source'] === 'call'  // признак звонка
        );
        if ($result['code'] === 200) {
            $successCount++;
            $pdoWriter->prepare("UPDATE fcm_tokens SET last_used = NOW(), failure_count = 0 WHERE token = ?")->execute([$row['token']]);
        } else {
            $error = json_decode($result['response'], true);
            echo json_encode($result['response'], true);
            if (isset($error['error']['status'])) {
                switch ($error['error']['status']) {
                    case 'NOT_FOUND':
                    case 'INVALID_ARGUMENT':
                        $deactivate = $pdoWriter->prepare("UPDATE fcm_tokens SET is_active = 0, failure_count = failure_count + 1 WHERE token = ?");
                        $deactivate->execute([$row['token']]);
                        break;
                    default:
                        $inc = $pdoWriter->prepare("UPDATE fcm_tokens SET failure_count = failure_count + 1 WHERE token = ?");
                        $inc->execute([$row['token']]);
                        break;
                }
            }
        }
    }

    echo json_encode(['success' => true, 'sent' => $successCount, 'total' => count($rows)]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}