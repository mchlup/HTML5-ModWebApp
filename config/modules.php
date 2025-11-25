<?php
session_start();
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if (empty($_SESSION['username'])) {
    jsonResponse(['success' => false, 'message' => 'Vyžadováno přihlášení.'], 401);
}

function listAvailableModules(): array
{
    $modules = [];
    $dir = __DIR__ . '/../modules';
    if (!is_dir($dir)) {
        return $modules;
    }
    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') continue;
        if (is_dir($dir . '/' . $name) && file_exists($dir . '/' . $name . '/index.js')) {
            $modules[] = [
                'id' => $name,
                'name' => ucfirst($name),
            ];
        }
    }
    return $modules;
}

try {
    $pdo = getDbConnection();
    $dbAvailable = true;
} catch (Throwable $e) {
    $dbAvailable = false;
}

if ($method === 'GET') {
    if ($dbAvailable) {
        $modules = [];
        try {
            $stmt = $pdo->query('SELECT id, name, enabled FROM app_modules');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $modules[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'enabled' => (bool)$row['enabled'],
                ];
            }
        } catch (Throwable $e) {
            $modules = [];
        }
        $enabled = array_values(array_unique(array_map(function ($m) { return $m['id']; }, array_filter($modules, function ($m) { return $m['enabled']; }))));
        jsonResponse(['success' => true, 'modules' => $modules, 'enabledModules' => $enabled, 'permissions' => []]);
    }

    if ($_SESSION['role'] === 'super-admin' && ($_SESSION['user_id'] ?? 1) === 0) {
        $mods = listAvailableModules();
        $enabled = array_map(function ($m) { return $m['id']; }, $mods);
        jsonResponse(['success' => true, 'modules' => $mods, 'enabledModules' => $enabled, 'permissions' => ['*' => 'full']]);
    }

    jsonResponse(['success' => false, 'message' => 'Moduly nelze načíst.'], 503);
}

// POST save enabled modules
if ($method === 'POST') {
    requireCsrfToken();
    if (!$dbAvailable) {
        jsonResponse(['success' => false, 'message' => 'Uložení bez databáze není možné.'], 503);
    }
    $data = json_decode(file_get_contents('php://input'), true);
    $enabled = is_array($data['enabledModules'] ?? null) ? $data['enabledModules'] : [];
    try {
        $pdo->exec('UPDATE app_modules SET enabled = 0');
        $stmt = $pdo->prepare('UPDATE app_modules SET enabled = 1 WHERE id = ?');
        foreach ($enabled as $id) {
            $stmt->execute([$id]);
        }
    } catch (Throwable $e) {
        jsonResponse(['success' => false, 'message' => 'Uložení se nezdařilo.'], 500);
    }
    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
