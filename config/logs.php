<?php
session_start();

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

/**
 * Jednoduchý endpoint pro čtení aplikačních logů pro modul "logs".
 *
 * Vrací JSON ve tvaru:
 * {
 *   "success": true,
 *   "logs": [
 *     { "time": "...", "level": "...", "user": "...", "message": "..." },
 *     ...
 *   ]
 * }
 */

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user   = $_SESSION['username'] ?? 'anonymous';
$role   = $_SESSION['role'] ?? 'guest';

ensureLoggedIn();

// Logy smí prohlížet jen admin / super‑admin
if (!in_array($role, ['super-admin', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}

if ($method !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
}

// Zkusíme DB, pokud je k dispozici, jinak fallback na souborové logy
$logs = [];

try {
    $pdo = null;
    try {
        $pdo = getDbConnection();
    } catch (Throwable $e) {
        $pdo = null;
    }

    if ($pdo instanceof PDO) {
        try {
            $stmt = $pdo->query('SELECT type, module, message, username, created_at FROM app_logs ORDER BY id DESC LIMIT 100');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $logs[] = [
                    'time'    => $row['created_at'] ?? null,
                    'level'   => $row['type'] ?? null,
                    'user'    => $row['username'] ?? null,
                    'message' => $row['message'] ?? '',
                ];
            }
        } catch (Throwable $e) {
            // Pokud tabulka neexistuje nebo je jiný problém, spadneme na souborové logy
            $pdo = null;
        }
    }
} catch (Throwable $e) {
    $logs = [];
}

// Fallback: souborové logy jako JSON řádky ve složce /logs/app.log
if (!$logs) {
    $logDir  = __DIR__ . '/../logs';
    $logFile = $logDir . '/app.log';
    if (file_exists($logFile)) {
        $lines = @file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (is_array($lines)) {
            // vezmeme posledních 100 záznamů
            $lines = array_slice($lines, -100);
            foreach ($lines as $line) {
                $decoded = json_decode($line, true);
                if (!is_array($decoded)) {
                    continue;
                }
                $logs[] = [
                    'time'    => $decoded['created_at'] ?? ($decoded['time'] ?? null),
                    'level'   => $decoded['type'] ?? ($decoded['level'] ?? null),
                    'user'    => $decoded['username'] ?? ($decoded['user'] ?? $user),
                    'message' => $decoded['message'] ?? '',
                ];
            }
        }
    }
}

jsonResponse(['success' => true, 'logs' => array_reverse($logs)]);
