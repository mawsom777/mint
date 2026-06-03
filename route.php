<?php
$requestUri = $_SERVER['REQUEST_URI'];
$parsedUrl = parse_url($requestUri);
$path = trim($parsedUrl['path'], '/');

session_start();

$segments = explode('/', $path);

$route = $segments[0] ?? '';

require_once __DIR__ . '/channel/index.php';

switch ($route) {
    case 'channel':
        $slug = $segments[1] ?? null;
        if ($slug) {
            showChannel($slug);
        } else {
            http_response_code(404);
            echo 'Укажите название канала в адресе.';
        }
        break;

    case 'main.php':
    case 'start.php':
    case 'main.html':
    case 'start.html':
        header('Location: index.html');
        break;

    default:
        // Любой другой путь — 404
        http_response_code(404);
        echo 'Страница не найдена.';
        break;
}