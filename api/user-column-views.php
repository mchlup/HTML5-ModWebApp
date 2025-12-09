<?php
session_start();

require_once __DIR__ . '/../config/common.php';
require_once __DIR__ . '/../config/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    ensureLoggedIn();
    $pdo = getDbConnection();
    $userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    if ($userId <= 0) {
        jsonResponse([
            'success' => false,
            'message' => 'Uživatelské ID není k dispozici.',
        ], 401);
    }

    ensureColumnViewTableExists($pdo);

    switch ($method) {
        case 'GET':
            handleGet($pdo, $userId);
            break;
        case 'POST':
            requireCsrfToken();
            handlePost($pdo, $userId);
            break;
        case 'DELETE':
            requireCsrfToken();
            handleDelete($pdo, $userId);
            break;
        default:
            jsonResponse([
                'success' => false,
                'message' => 'Metoda není podporována.',
            ], 405);
    }
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Operace se nezdařila: ' . $e->getMessage(),
    ], 500);
}

function ensureColumnViewTableExists(PDO $pdo): void
{
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'mysql') {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_user_column_views (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                module_code VARCHAR(100) NOT NULL,
                view_code VARCHAR(100) NOT NULL,
                columns_json LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_user_view (user_id, module_code, view_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
        );
    } else {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_user_column_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                module_code TEXT NOT NULL,
                view_code TEXT NOT NULL,
                columns_json TEXT NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, module_code, view_code)
            );'
        );
    }
}

function validateIdentifiers(array $source): array
{
    $moduleCode = trim((string) ($source['moduleCode'] ?? ''));
    $viewCode   = trim((string) ($source['viewCode'] ?? ''));

    if ($moduleCode === '' || $viewCode === '') {
        jsonResponse([
            'success' => false,
            'message' => 'Chybí identifikátor modulu nebo pohledu.',
        ], 400);
    }

    return [
        'moduleCode' => mb_substr($moduleCode, 0, 100),
        'viewCode'   => mb_substr($viewCode, 0, 100),
    ];
}

function handleGet(PDO $pdo, int $userId): void
{
    $params = validateIdentifiers($_GET);

    $stmt = $pdo->prepare(
        'SELECT columns_json FROM app_user_column_views
         WHERE user_id = :user AND module_code = :module AND view_code = :view'
    );
    $stmt->execute([
        ':user'   => $userId,
        ':module' => $params['moduleCode'],
        ':view'   => $params['viewCode'],
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $columns = [];
    if ($row && isset($row['columns_json'])) {
        $decoded = json_decode($row['columns_json'], true);
        if (is_array($decoded)) {
            $columns = $decoded;
        }
    }

    jsonResponse([
        'success' => true,
        'columns' => $columns,
    ]);
}

function handlePost(PDO $pdo, int $userId): void
{
    $payloadRaw = file_get_contents('php://input');
    $payload    = json_decode($payloadRaw, true) ?: [];

    $params  = validateIdentifiers($payload);
    $columns = $payload['columns'] ?? [];
    if (!is_array($columns)) {
        $columns = [];
    }

    $columnsPrepared = [];
    foreach ($columns as $index => $col) {
        if (!isset($col['id'])) {
            continue;
        }
        $columnsPrepared[] = [
            'id'      => (string) $col['id'],
            'visible' => isset($col['visible']) ? (bool) $col['visible'] : true,
            'width'   => isset($col['width']) && $col['width'] !== '' ? (string) $col['width'] : null,
            'order'   => is_numeric($col['order']) ? (int) $col['order'] : (int) $index,
        ];
    }

    $columnsJson = json_encode($columnsPrepared, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'mysql') {
        $sql = 'INSERT INTO app_user_column_views (user_id, module_code, view_code, columns_json, updated_at)
                VALUES (:user, :module, :view, :columns, NOW())
                ON DUPLICATE KEY UPDATE columns_json = VALUES(columns_json), updated_at = VALUES(updated_at)';
    } else {
        $sql = 'INSERT INTO app_user_column_views (user_id, module_code, view_code, columns_json, updated_at)
                VALUES (:user, :module, :view, :columns, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, module_code, view_code)
                DO UPDATE SET columns_json = excluded.columns_json, updated_at = excluded.updated_at';
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':user'    => $userId,
        ':module'  => $params['moduleCode'],
        ':view'    => $params['viewCode'],
        ':columns' => $columnsJson,
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'Nastavení sloupců bylo uloženo.',
    ]);
}

function handleDelete(PDO $pdo, int $userId): void
{
    $params = validateIdentifiers($_GET);

    $stmt = $pdo->prepare(
        'DELETE FROM app_user_column_views WHERE user_id = :user AND module_code = :module AND view_code = :view'
    );
    $stmt->execute([
        ':user'   => $userId,
        ':module' => $params['moduleCode'],
        ':view'   => $params['viewCode'],
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'Nastavení bylo obnoveno do výchozího stavu.',
    ]);
}
