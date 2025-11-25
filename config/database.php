<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$configExists = file_exists(__DIR__ . '/db_config.json');

if ($configExists) {
    if (empty($_SESSION['role']) || $_SESSION['role'] !== 'super-admin') {
        jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
    }
    if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        requireCsrfToken();
    }
}

if ($action === 'test') {
    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $payload['host'] ?? '', $payload['name'] ?? '');
    try {
        $pdo = new PDO($dsn, $payload['user'] ?? '', $payload['pass'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        jsonResponse(['success' => true, 'message' => 'Připojení úspěšné.']);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Připojení se nezdařilo.'], 400);
    }
}

if ($action === 'provision' && $method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!$configExists) {
        // dovoleno bez session
    }
    try {
        file_put_contents(__DIR__ . '/db_config.json', json_encode([
            'host' => $payload['host'] ?? 'localhost',
            'db' => $payload['name'] ?? '',
            'user' => $payload['user'] ?? '',
            'password' => $payload['pass'] ?? '',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        jsonResponse(['success' => true, 'message' => 'Konfigurace uložena.']);
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Uložení se nezdařilo.'], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná akce.'], 400);
