<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (empty($_SESSION['role']) || !in_array($_SESSION['role'], ['super-admin', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Nedostatečná oprávnění.'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

try {
    $pdo = getDbConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Databázové připojení se nezdařilo: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($method === 'GET') {
    try {
        // Uživatelé
        $users = [];
        $stmt = $pdo->query('SELECT id, username, role FROM app_users ORDER BY username');
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $users[] = [
                'id' => (int) $row['id'],
                'username' => (string) $row['username'],
                'role' => $row['role'] !== null ? (string) $row['role'] : 'user',
            ];
        }

        // Moduly z tabulky app_modules
        $modules = [];
        $seen = [];

        $stmt = $pdo->query('SELECT id, enabled FROM app_modules ORDER BY id');
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $id = (string) $row['id'];
            $modules[] = [
                'id' => $id,
                'enabled' => !empty($row['enabled']),
            ];
            $seen[$id] = true;
        }

        // Doplň moduly z adresáře /modules (pro jistotu)
        $modulesDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'modules';
        if (is_dir($modulesDir)) {
            foreach (scandir($modulesDir) as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $full = $modulesDir . DIRECTORY_SEPARATOR . $entry;
                if (!is_dir($full)) {
                    continue;
                }
                if (!isset($seen[$entry])) {
                    $modules[] = [
                        'id' => $entry,
                        'enabled' => true,
                    ];
                    $seen[$entry] = true;
                }
            }
        }

        // Ploché permissions (user_id, module_id, rights)
        $permissions = [];
        $stmt = $pdo->query('SELECT user_id, module_id, rights FROM app_permissions');
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $permissions[] = [
                'user_id' => (int) $row['user_id'],
                'module_id' => (string) $row['module_id'],
                'rights' => (string) $row['rights'],
            ];
        }

        echo json_encode([
            'success' => true,
            'users' => $users,
            'modules' => $modules,
            'permissions' => $permissions,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Chyba při načítání oprávnění: ' . $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input) || !isset($input['permissions']) || !is_array($input['permissions'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Neplatný formát požadavku.'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    $permissions = $input['permissions'];

    try {
        $pdo->beginTransaction();

        // Jednoduchý model: smažeme všechna oprávnění a vložíme znovu to, co přijde z UI
        $pdo->exec('DELETE FROM app_permissions');

        $stmtInsert = $pdo->prepare(
            'INSERT INTO app_permissions (user_id, module_id, rights) VALUES (:user_id, :module_id, :rights)'
        );

        foreach ($permissions as $perm) {
            $userId = isset($perm['user_id']) ? (int) $perm['user_id'] : 0;
            $moduleId = isset($perm['module_id']) ? trim((string) $perm['module_id']) : '';
            $rights = isset($perm['rights']) ? (string) $perm['rights'] : 'none';

            if ($userId <= 0 || $moduleId === '' || $rights === 'none') {
                // none = žádný záznam (žádný řádek v app_permissions)
                continue;
            }

            $stmtInsert->execute([
                ':user_id' => $userId,
                ':module_id' => $moduleId,
                ':rights' => $rights,
            ]);
        }

        $pdo->commit();

        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Chyba při ukládání oprávnění: ' . $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
    exit;
}

http_response_code(405);
echo json_encode(
    ['success' => false, 'message' => 'Nepodporovaná HTTP metoda.'],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);

