<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$isSuperAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'super-admin';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function listModulesFromDisk(string $modulesDir): array
{
    $result = [];
    if (!is_dir($modulesDir)) {
        return $result;
    }
    foreach (scandir($modulesDir) as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $full = $modulesDir . '/' . $name;
        if (!is_dir($full)) {
            continue;
        }
        $indexJs = $full . '/index.js';
        if (!file_exists($indexJs)) {
            continue;
        }
        $result[] = [
            'id' => $name,
            'entry' => "./modules/{$name}/index.js",
        ];
    }
    return $result;
}

if (empty($_SESSION['username'])) {
    respond(['success' => false, 'message' => 'Uživatel není přihlášen.'], 401);
}

if ($method === 'POST') {
    if (empty($_SESSION['role']) || !in_array($_SESSION['role'], ['super-admin', 'admin'], true)) {
        respond(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $enabledModules = isset($input['enabledModules']) && is_array($input['enabledModules'])
        ? $input['enabledModules']
        : [];
    try {
        require_once __DIR__ . '/db_connect.php';
        $pdo = getDbConnection();
    } catch (Throwable $e) {
        respond(['success' => false, 'message' => 'Databázové připojení není dostupné.'], 500);
    }
    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM app_modules');
        if (!empty($enabledModules)) {
            $stmt = $pdo->prepare('INSERT INTO app_modules (id, enabled) VALUES (?, 1)');
            foreach ($enabledModules as $moduleId) {
                $stmt->execute([$moduleId]);
            }
        }
        $pdo->commit();
        respond(['success' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['success' => false, 'message' => 'Uložení modulů selhalo.'], 500);
    }
}

$baseDir = __DIR__ . '/..';
$modulesDir = $baseDir . '/modules';

$enabledSet = null;
$userPermissions = [];
$dbAvailable = false;

try {
    require_once __DIR__ . '/db_connect.php';
    $pdo = getDbConnection();
    $dbAvailable = true;
    $stmt = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
    $enabledSet = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    $enabledSet = $enabledSet ? array_flip($enabledSet) : [];
    if (!empty($_SESSION['user_id'])) {
        $stmt2 = $pdo->prepare('SELECT module_id, rights FROM app_permissions WHERE user_id = ?');
        $stmt2->execute([$_SESSION['user_id']]);
        while ($perm = $stmt2->fetch(PDO::FETCH_ASSOC)) {
            $userPermissions[$perm['module_id']] = $perm['rights'];
        }
    }
} catch (Throwable $e) {
    $enabledSet = null;
    $dbAvailable = false;
}

// Fallback bez DB pro super-admina
if (!$dbAvailable) {
    if ($isSuperAdmin && (int)($_SESSION['user_id'] ?? -1) === 0) {
        $modules = listModulesFromDisk($modulesDir);
        $enabledIds = array_map(fn($m) => $m['id'], $modules);
        respond([
            'success' => true,
            'modules' => $modules,
            'enabledModules' => $enabledIds,
            'permissions' => ['*' => 'full'],
        ]);
    }
    respond(['success' => false, 'message' => 'Databáze není dostupná.'], 503);
}

$result = ['success' => true, 'modules' => []];
$items = listModulesFromDisk($modulesDir);

foreach ($items as $entry) {
    $id = $entry['id'];
    if (!$isSuperAdmin && is_array($enabledSet)) {
        if ($id !== 'config' && !isset($enabledSet[$id])) {
            continue;
        }
        if (isset($userPermissions[$id]) && $userPermissions[$id] === 'none') {
            continue;
        }
    }
    $result['modules'][] = $entry;
}

$result['enabledModules'] = array_keys($enabledSet ?? []);
$result['permissions'] = $userPermissions;

respond($result);
