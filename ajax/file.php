<?php
require_once 'config.php';

$key = $_GET['key'] ?? '';
$download = isset($_GET['download']) && $_GET['download'] === '1';

if (!$key) { 
    http_response_code(400); 
    echo json_encode(['error' => 'Key missing']);
    exit; 
}

$minio = getMinIOConnection();
if (!$minio) {
    http_response_code(500);
    echo json_encode(['error' => 'Storage connection failed']);
    exit;
}

$bucket = config('minio.bucket');

$pdoChecker = getDBCheckerConnection();
$stmt = $pdoChecker->prepare("SELECT original_name, mime_type FROM files WHERE minio_key = ?");
$stmt->execute([$key]);
$fileData = $stmt->fetch();

$originalName = $fileData['original_name'] ?? 'file';
$mimeType = $fileData['mime_type'] ?? 'application/octet-stream';

try {
    $cmd = $minio->getCommand('GetObject', [
        'Bucket' => $bucket, 
        'Key'    => $key
    ]);
    
    $request = $minio->createPresignedRequest($cmd, '+15 minutes');
    $uri = (string) $request->getUri();
    
    $publicHost = 'https://mint.cloudpub.ru/storage/';
    $uri = preg_replace('#^http://localhost:9000/#', $publicHost, $uri);
    $uri = preg_replace('#^https?://[^/]+/storage/#', $publicHost, $uri);
    
    $isMedia = strpos($mimeType, 'image/') === 0;
    
    if ($download || !$isMedia) {
        header('Content-Type: ' . $mimeType);
        header('Content-Disposition: attachment; filename="' . urlencode($originalName) . '"');
        header('Content-Length: ' . $minio->headObject(['Bucket' => $bucket, 'Key' => $key])['ContentLength']);
        header('Cache-Control: private, max-age=0, must-revalidate');
        
        readfile($uri);
        exit;
    }
    
    header('Location: ' . $uri);
    exit;
    
} catch (Exception $e) {
    error_log('[File Access Error] ' . $e->getMessage());
    http_response_code(404);
    echo json_encode(['error' => 'File not found']);
}
