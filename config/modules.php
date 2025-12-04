<?php
session_start();

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role = $_SESSION['role'] ?? 'guest';
$isAuthenticated = !empty($_SESSION['username']);

function dbHasTable(PDO $pdo, string $table): bool
{
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
            $stmt->execute([$table]);
            return (bool) $stmt->fetchColumn();
        }
        if ($driver === 'sqlite') {
            $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
            $stmt->execute([$table]);
            return (bool) $stmt->fetchColumn();
        }
        // generic fallback
        $pdo->query("SELECT 1 FROM {$table} LIMIT 1");
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function fetchPermissions(PDO $pdo): array
{
    try {
        $stmt = $pdo->query('SELECT role, module_id, level FROM app_permissions');
        $permissions = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $role = (string) ($row['role'] ?? 'user');
            $moduleId = (string) ($row['module_id'] ?? '');
            $level = (string) ($row['level'] ?? 'none');
            if ($moduleId === '') {
                continue;
            }
            if (!isset($permissions[$role])) {
                $permissions[$role] = [];
            }
            $permissions[$role][$moduleId] = $level;
        }
        return $permissions;
    } catch (Throwable $e) {
        try {
            $stmt = $pdo->query('SELECT role, module_id, rights FROM app_permissions');
            $permissions = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $role = (string) ($row['role'] ?? 'user');
                $moduleId = (string) ($row['module_id'] ?? '');
                $level = (string) ($row['rights'] ?? 'none');
                if ($moduleId === '') {
                    continue;
                }
                if (!isset($permissions[$role])) {
                    $permissions[$role] = [];
                }
                $permissions[$role][$moduleId] = $level;
            }
            return $permissions;
        } catch (Throwable $e2) {
            return [];
        }
    }
}

function respondWithFallback(?array $available = null, bool $dbAvailable = false): void
{
    $mods = $available ?? listAvailableModules();
    $enabled = array_map(static fn(array $m) => (string) $m['id'], $mods);
    jsonResponse([
        'success' => true,
        'modules' => $mods,
        'enabledModules' => $enabled,
        'permissions' => ['super-admin' => ['*' => 'full']],
        'dbAvailable' => $dbAvailable,
    ]);
}

$pdo = null;
$dbAvailable = false;
try {
    $pdo = getDbConnection();
    $dbAvailable = $pdo instanceof PDO;
} catch (Throwable $e) {
    $dbAvailable = false;
}

if ($method === 'GET') {
    $modules = [];
    $enabled = [];
    $permissions = [];

    $available = listAvailableModules();
    $availableById = [];
    foreach ($available as $item) {
        $availableById[$item['id']] = $item;
    }

    if ($isAuthenticated && $dbAvailable && $pdo instanceof PDO && dbHasTable($pdo, 'app_modules')) {
        try {
            $stmt = $pdo->query('SELECT id, name, enabled, category, sort_order, description, version FROM app_modules');
        } catch (Throwable $e) {
            $stmt = $pdo->query('SELECT id, name, enabled, category, sort_order FROM app_modules');
        }
        try {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $id = (string) $row['id'];
                $fallback = $availableById[$id] ?? [];
                $modules[] = [
                    'id' => (string) $row['id'],
                    'name' => (string) ($row['name'] ?? $fallback['name'] ?? $row['id']),
                    'description' => $row['description'] ?? ($fallback['description'] ?? null),
                    'version' => $row['version'] ?? ($fallback['version'] ?? null),
                    'category' => $row['category'] ?? ($fallback['category'] ?? null),
                    'order' => (int) ($row['sort_order'] ?? ($fallback['order'] ?? 0)),
                    'enabled' => (bool) $row['enabled'],
                ];
            }
            $enabled = array_values(array_filter(array_map(static function (array $m) {
                return !empty($m['enabled']) ? (string) $m['id'] : null;
            }, $modules)));
            $permissions = fetchPermissions($pdo);
            jsonResponse([
                'success' => true,
                'modules' => $modules,
                'enabledModules' => $enabled,
                'permissions' => $permissions,
                'dbAvailable' => true,
            ]);
        } catch (Throwable $e) {
            $modules = [];
        }
    }

    if ($isAuthenticated && $role === 'super-admin') {
        respondWithFallback($available, $dbAvailable);
    }

    $appDefinition = loadAppDefinition();
    $sa = $appDefinition['superAdmin'] ?? [];
    $allowFallbackWithoutDb = !empty($sa['allowFallbackWithoutDb']);
    if (!$dbAvailable && !$allowFallbackWithoutDb) {
        jsonResponse([
            'success' => false,
            'message' => 'Fallback without database is disabled.',
            'dbAvailable' => $dbAvailable,
        ], 503);
    }
    $defaultEnabled = array_values(array_filter(
        $appDefinition['defaultEnabledModules'] ?? [],
        static fn($id) => isset($availableById[(string) $id])
    ));
    if (!$defaultEnabled) {
        $defaultEnabled = array_map(static fn(array $m) => (string) $m['id'], $available);
    }

    jsonResponse([
        'success' => true,
        'modules' => $available,
        'enabledModules' => $defaultEnabled,
        'permissions' => [],
        'dbAvailable' => $dbAvailable,
    ]);
}

if ($method === 'POST') {
    ensureLoggedIn();
    $allowSuperAdminWithoutCsrf = true;
    if (!($allowSuperAdminWithoutCsrf && $role === 'super-admin')) {
        requireCsrfToken();
    }

    if (!$dbAvailable || !$pdo instanceof PDO) {
        jsonResponse([
            'success' => false,
            'message' => 'Uložení konfigurace modulů bez funkční databáze není možné.',
        ], 503);
    }

    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    $enabledModules = is_array($payload['enabledModules'] ?? null) ? $payload['enabledModules'] : [];

    try {
        $pdo->beginTransaction();
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_modules (
                id VARCHAR(190) PRIMARY KEY,
                name VARCHAR(255) NULL,
                enabled TINYINT(1) DEFAULT 0,
                category VARCHAR(100) NULL,
                sort_order INT DEFAULT 0
            )'
        );

        $available = listAvailableModules();
        $knownIds = [];

        foreach ($available as $module) {
            $id = (string) $module['id'];
            $knownIds[] = $id;
            $update = $pdo->prepare('UPDATE app_modules SET name = ?, category = ?, sort_order = ?, enabled = ? WHERE id = ?');
            $update->execute([
                $module['name'] ?? $id,
                $module['category'] ?? null,
                $module['order'] ?? 0,
                in_array($id, $enabledModules, true) ? 1 : 0,
                $id,
            ]);
            if ($update->rowCount() === 0) {
                $insert = $pdo->prepare('INSERT INTO app_modules (id, name, category, sort_order, enabled) VALUES (?, ?, ?, ?, ?)');
                $insert->execute([
                    $id,
                    $module['name'] ?? $id,
                    $module['category'] ?? null,
                    $module['order'] ?? 0,
                    in_array($id, $enabledModules, true) ? 1 : 0,
                ]);
            }
        }

        if ($knownIds) {
            $placeholders = implode(',', array_fill(0, count($knownIds), '?'));
            $disable = $pdo->prepare("UPDATE app_modules SET enabled = 0 WHERE id NOT IN ($placeholders)");
            $disable->execute($knownIds);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse([
            'success' => false,
            'message' => 'Uložení se nezdařilo.',
        ], 500);
    }

    try {
        $stmt = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
        $enabled = $stmt->fetchAll(PDO::FETCH_COLUMN, 0) ?: [];
    } catch (Throwable $e) {
        $enabled = $enabledModules;
    }

    jsonResponse([
        'success' => true,
        'enabledModules' => array_values(array_unique($enabled)),
    ]);
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
