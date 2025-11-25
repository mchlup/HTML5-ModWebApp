<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = $_SESSION['username'] ?? 'anonymous';
$role = $_SESSION['role'] ?? 'guest';

ensureLoggedIn();

function writeFileLog(array $entry): void
{
    $dir = __DIR__ . '/../logs';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    file_put_contents($dir . '/app.log', $line . PHP_EOL, FILE_APPEND);
}

try {
    $pdo = getDbConnection();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'mysql') {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(50) NULL,
                module VARCHAR(190) NULL,
                message TEXT NULL,
                username VARCHAR(190) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'
        );
    } else {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type VARCHAR(50) NULL,
                module VARCHAR(190) NULL,
                message TEXT NULL,
                username VARCHAR(190) NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )'
        );
    }
} catch (Throwable $e) {
    $pdo = null;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $entry = [
        'type' => $input['type'] ?? 'info',
        'module' => $input['module'] ?? null,
        'message' => $input['message'] ?? '',
        'username' => $user,
        'created_at' => date('c'),
    ];

    try {
        if ($pdo instanceof PDO) {
            $stmt = $pdo->prepare('INSERT INTO app_logs (type, module, message, username) VALUES (?, ?, ?, ?)');
            $stmt->execute([$entry['type'], $entry['module'], $entry['message'], $entry['username']]);
        } else {
            writeFileLog($entry);
        }
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        writeFileLog($entry);
        jsonResponse(['success' => false, 'message' => 'Log nelze uložit.'], 500);
    }
}

if ($method === 'GET') {
    if (!in_array($role, ['super-admin', 'admin'], true)) {
        jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
    }

    if ($pdo instanceof PDO) {
        $stmt = $pdo->query('SELECT id, type, module, message, username, created_at FROM app_logs ORDER BY id DESC LIMIT 100');
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(['success' => true, 'logs' => $logs]);
    }

    $file = __DIR__ . '/../logs/app.log';
    $logs = [];
    if (file_exists($file)) {
        $lines = array_slice(file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES), -100);
        foreach ($lines as $line) {
            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                $logs[] = $decoded;
            }
        }
    }
    jsonResponse(['success' => true, 'logs' => array_reverse($logs)]);
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
