<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    if (empty($_SESSION['role']) || !in_array($_SESSION['role'], ['super-admin', 'admin'], true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Nedostatečná oprávnění.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $enabledModules = isset($input['enabledModules']) && is_array($input['enabledModules'])
        ? $input['enabledModules']
        : [];
    try {
        require_once __DIR__ . '/db_connect.php';
        $pdo = getDbConnection();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Databázové připojení není dostupné.']);
        exit;
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
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Uložení modulů selhalo.']);
    }
    exit;
}

$baseDir = __DIR__ . '/..';
$modulesDir = $baseDir . '/modules';
$result = ['modules' => []];

if (empty($_SESSION['username'])) {
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$enabledSet = null;
$userPermissions = [];
try {
    require_once __DIR__ . '/db_connect.php';
    $pdo = getDbConnection();
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
} catch (Exception $e) {
    $enabledSet = null;
}

if (!is_dir($modulesDir)) {
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$items = scandir($modulesDir);
foreach ($items as $name) {
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
    $id = $name;
    if (is_array($enabledSet)) {
        if ($id !== 'config' && !isset($enabledSet[$id])) {
            continue;
        }
        if (isset($userPermissions[$id]) && $userPermissions[$id] === 'none') {
            continue;
        }
    }
    $result['modules'][] = [
        'id' => $id,
        'entry' => "./modules/{$id}/index.js",
    ];
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
