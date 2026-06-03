<?php
require_once 'config.php';
require_once 'tokensJWT.php';
header('Content-Type: application/json');

try {
    $userId = authenticateAndGetUserId();
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication failed: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_FILES['file'])) {
    $error = 'Invalid request - no file uploaded';
    error_log('[Upload Error] ' . $error);
    echo json_encode(['error' => $error]);
    exit;
}

$file = $_FILES['file'];
$compress = isset($_POST['compress']) && $_POST['compress'] === '1';

$uploadDir = sys_get_temp_dir() . '/uploads_' . uniqid();
if (!mkdir($uploadDir, 0755, true)) {
    $error = 'Failed to create temp directory: ' . $uploadDir;
    error_log('[Upload Error] ' . $error);
    error_log('[Upload Error] Temp dir: ' . sys_get_temp_dir() . ' - Permissions: ' . substr(sprintf('%o', fileperms(sys_get_temp_dir())), -4));
    echo json_encode(['error' => $error]);
    exit;
}

$filePath = $uploadDir . '/' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $file['name']);

if (!is_writable($uploadDir)) {
    $error = 'Temp directory is not writable: ' . $uploadDir;
    error_log('[Upload Error] ' . $error);
    echo json_encode(['error' => $error]);
    exit;
}

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    $error = 'Failed to move uploaded file';
    error_log('[Upload Error] ' . $error);
    error_log('[Upload Error] From: ' . $file['tmp_name']);
    error_log('[Upload Error] To: ' . $filePath);
    error_log('[Upload Error] Temp dir: ' . sys_get_temp_dir());
    error_log('[Upload Error] PHP User: ' . get_current_user() . ' (UID: ' . posix_getuid() . ')');
    echo json_encode(['error' => $error]);
    exit;
}

$mimeType = mime_content_type($filePath);
$processedPath = $filePath;
$thumbPath = null;

try {
    if (strpos($mimeType, 'image/') === 0) {
        $thumbPath = $uploadDir . '/thumb_' . pathinfo($file['name'], PATHINFO_FILENAME) . '.jpg';
        createThumbnail($filePath, $thumbPath, 1280, 1280);
    } 
} catch (Exception $e) {
    error_log('[Upload Error] Processing failed: ' . $e->getMessage());
    $processedPath = $filePath;
}

$minio = getMinIOConnection();
if (!$minio) {
    $error = 'MinIO connection failed';
    error_log('[Upload Error] ' . $error);
    cleanupDir($uploadDir);
    echo json_encode(['error' => $error]);
    exit;
}

$bucket = config('minio.bucket');
$uniqueKey = uniqid() . '_' . basename($processedPath);
$thumbKey = null;

try {
    $minio->putObject([
        'Bucket' => $bucket,
        'Key'    => $uniqueKey,
        'SourceFile' => $processedPath,
        'ContentType' => $mimeType,
    ]);

    if ($thumbPath && file_exists($thumbPath)) {
        $thumbKey = 'thumb_' . $uniqueKey;
        $minio->putObject([
            'Bucket' => $bucket,
            'Key'    => $thumbKey,
            'SourceFile' => $thumbPath,
            'ContentType' => 'image/jpeg',
        ]);
    }
} catch (Exception $e) {
    $error = 'Upload to MinIO failed: ' . $e->getMessage();
    error_log('[Upload Error] ' . $error);
    cleanupDir($uploadDir);
    echo json_encode(['error' => $error]);
    exit;
}

$pdoWriter = getDBWriterConnection();
$stmt = $pdoWriter->prepare("INSERT INTO files (original_name, minio_key, mime_type, size, is_compressed) VALUES (?, ?, ?, ?, ?)");
$stmt->execute([
    $file['name'],
    $uniqueKey,
    $mimeType,
    filesize($processedPath),
    $compress ? 1 : 0
]);

cleanupDir($uploadDir);

error_log('[Upload Success] File uploaded: ' . $file['name'] . ' -> Key: ' . $uniqueKey);

echo json_encode([
    'success'   => true,
    'file_id'   => $pdoWriter->lastInsertId(),
    'file_key'  => $uniqueKey,
    'thumb_key' => $thumbKey,
    'mime_type' => $mimeType
]);

function cleanupDir($dir) {
    array_map('unlink', glob("$dir/*"));
    rmdir($dir);
}


function compressImage($src, $dst, $maxW, $maxH) {
    $info = getimagesize($src);
    $mime = $info['mime'];
    $srcImg = match($mime) {
        'image/jpeg' => imagecreatefromjpeg($src),
        'image/png'  => imagecreatefrompng($src),
        'image/webp' => imagecreatefromwebp($src),
        default      => imagecreatefromjpeg($src)
    };
    $ratio = min($maxW / imagesx($srcImg), $maxH / imagesy($srcImg));
    $newW = (int)(imagesx($srcImg) * $ratio);
    $newH = (int)(imagesy($srcImg) * $ratio);
    $dstImg = imagecreatetruecolor($newW, $newH);
    imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newW, $newH, imagesx($srcImg), imagesy($srcImg));
    imagejpeg($dstImg, $dst, 85);
    unset($srcImg, $dstImg);
}

function createThumbnail($src, $dst, $maxW = 1280, $maxH = 1280) {
    $info = getimagesize($src);
    $mime = $info['mime'];
    $srcImg = match($mime) {
        'image/jpeg' => imagecreatefromjpeg($src),
        'image/png'  => imagecreatefrompng($src),
        'image/webp' => imagecreatefromwebp($src),
        default      => imagecreatefromjpeg($src)
    };
    if (!$srcImg) return;
    $origW = imagesx($srcImg);
    $origH = imagesy($srcImg);
    if ($origW <= $maxW && $origH <= $maxH) {
        $newW = $origW;
        $newH = $origH;
    } else {
        $ratio = min($maxW / $origW, $maxH / $origH);
        $newW = (int)($origW * $ratio);
        $newH = (int)($origH * $ratio);
    }
    $dstImg = imagecreatetruecolor($newW, $newH);
    imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newW, $newH, $origW, $origH);
    imagejpeg($dstImg, $dst, 80);
    unset($srcImg, $dstImg);
}

function compressVideo($src, $dst, $maxW, $maxH) {
    $cmd = sprintf('ffmpeg -i %s -vf "scale=%d:%d:force_original_aspect_ratio=decrease" -c:v libx264 -crf 23 -c:a aac -b:a 128k %s 2>&1',
        escapeshellarg($src), $maxW, $maxH, escapeshellarg($dst));
    exec($cmd, $output, $return);
    if ($return !== 0) copy($src, $dst);
}

function generateVideoThumbnail($src, $dst) {
    $cmd = sprintf('ffmpeg -i %s -vf "thumbnail,scale=300:300" -frames:v 1 %s 2>&1',
        escapeshellarg($src), escapeshellarg($dst));
    exec($cmd);
}
