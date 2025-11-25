<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role = $_SESSION['role'] ?? 'guest';

if (empty($role) || !in_array($role, ['super-admin', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    requireCsrfToken();
}

try {
    $pdo = getDbConnection();
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Databázové připojení se nezdařilo: ' . $e->getMessage(),
    ], 500);
}

$driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
if ($driver === 'mysql') {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role VARCHAR(50) NOT NULL,
            module_id VARCHAR(190) NOT NULL,
            level VARCHAR(50) NOT NULL DEFAULT "none"
        )'
    );
} else {
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role VARCHAR(50) NOT NULL,
            module_id VARCHAR(190) NOT NULL,
            level VARCHAR(50) NOT NULL DEFAULT "none"
        )'
    );
}

if ($method === 'GET') {
    try {
        $users = [];
        $stmt = $pdo->query('SELECT id, username, role FROM app_users ORDER BY username');
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $users[] = [
                'id' => (int) $row['id'],
                'username' => (string) $row['username'],
                'role' => $row['role'] !== null ? (string) $row['role'] : 'user',
            ];
        }

        $modules = [];
        try {
            $modStmt = $pdo->query('SELECT id, enabled FROM app_modules ORDER BY sort_order');
            while ($row = $modStmt->fetch(PDO::FETCH_ASSOC)) {
                $modules[] = [
                    'id' => (string) $row['id'],
                    'enabled' => !empty($row['enabled']),
                ];
            }
        } catch (Throwable $e) {
            $modules = listAvailableModules();
        }

        $permissions = [];
        $permStmt = $pdo->query('SELECT role, module_id, level FROM app_permissions');
        while ($row = $permStmt->fetch(PDO::FETCH_ASSOC)) {
            $r = (string) ($row['role'] ?? 'user');
            $module = (string) ($row['module_id'] ?? '');
            if ($module === '') {
                continue;
            }
            if (!isset($permissions[$r])) {
                $permissions[$r] = [];
            }
            $permissions[$r][$module] = (string) ($row['level'] ?? 'none');
        }

        jsonResponse([
            'success' => true,
            'users' => $users,
            'modules' => $modules,
            'permissions' => $permissions,
        ]);
    } catch (Throwable $e) {
        jsonResponse([
            'success' => false,
            'message' => 'Chyba při načítání oprávnění: ' . $e->getMessage(),
        ], 500);
    }
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $permissions = is_array($input['permissions'] ?? null) ? $input['permissions'] : null;
    if ($permissions === null) {
        jsonResponse(['success' => false, 'message' => 'Neplatný formát požadavku.'], 400);
    }

    try {
        $pdo->beginTransaction();
        $pdo->exec('DELETE FROM app_permissions');
        $stmtInsert = $pdo->prepare(
            'INSERT INTO app_permissions (role, module_id, level) VALUES (:role, :module_id, :level)'
        );
        foreach ($permissions as $roleKey => $modules) {
            if (!is_array($modules)) {
                continue;
            }
            foreach ($modules as $moduleId => $level) {
                if ($level === 'none' || $moduleId === '') {
                    continue;
                }
                $stmtInsert->execute([
                    ':role' => (string) $roleKey,
                    ':module_id' => (string) $moduleId,
                    ':level' => (string) $level,
                ]);
            }
        }
        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse([
            'success' => false,
            'message' => 'Chyba při ukládání oprávnění: ' . $e->getMessage(),
        ], 500);
    }
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná HTTP metoda.'], 405);
