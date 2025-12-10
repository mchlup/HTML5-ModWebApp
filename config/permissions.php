<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role   = $_SESSION['role'] ?? 'guest';

// musí být přihlášený uživatel
ensureLoggedIn();

// pouze admin / super-admin mají přístup do správy oprávnění
if (!in_array($role, ['super-admin', 'admin'], true)) {
    jsonResponse(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}

// zápisy chránit CSRF
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

/**
 * Lokální helper na kontrolu existence tabulky.
 */
function permDbHasTable(PDO $pdo, string $table): bool
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

        $pdo->query("SELECT 1 FROM {$table} LIMIT 1");
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Zajistí tabulku app_permissions a jednoduchou migraci starších schémat.
 * - nové schéma: id, role, module_id, level
 * - starší schéma: může mít rights místo level, nebo chybějící role
 */
function ensurePermissionsTable(PDO $pdo): void
{
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    // tabulka ještě neexistuje => vytvoříme rovnou nové schéma
    if (!permDbHasTable($pdo, 'app_permissions')) {
        if ($driver === 'mysql') {
            $pdo->exec(
                "CREATE TABLE IF NOT EXISTS app_permissions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    role VARCHAR(50) NOT NULL,
                    module_id VARCHAR(190) NOT NULL,
                    level VARCHAR(50) NOT NULL DEFAULT 'none',
                    UNIQUE KEY uniq_role_module (role, module_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );
        } else {
            $pdo->exec(
                "CREATE TABLE IF NOT EXISTS app_permissions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    module_id TEXT NOT NULL,
                    level TEXT NOT NULL DEFAULT 'none'
                )"
            );
            $pdo->exec(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_role_module 
                 ON app_permissions(role, module_id)"
            );
        }
        return;
    }

    // tabulka existuje – zkusíme zjistit sloupce a případně doplnit role/level
    $columns = [];
    try {
        if ($driver === 'mysql') {
            $stmt = $pdo->query('SHOW COLUMNS FROM app_permissions');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[] = $row['Field'] ?? '';
            }
        } elseif ($driver === 'sqlite') {
            $stmt = $pdo->query('PRAGMA table_info(app_permissions)');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[] = $row['name'] ?? '';
            }
        }
    } catch (Throwable $e) {
        // nepovedlo se zjistit sloupce – nebudeme dál migrovat
    }

    // chybějící sloupec role => přidáme
    if ($columns && !in_array('role', $columns, true)) {
        try {
            $pdo->exec("ALTER TABLE app_permissions ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'");
        } catch (Throwable $e) {
            // např. SQLite – zkusíme verzi s TEXT
            try {
                $pdo->exec("ALTER TABLE app_permissions ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
            } catch (Throwable $e2) {
                // když selže i to, necháme na fallbacku v SELECTu
            }
        }
    }

    // starší schéma může mít rights místo level – to řešíme v SELECTu
}

ensurePermissionsTable($pdo);

if ($method === 'GET') {
    try {
        // seznam uživatelů
        $users = [];
        if (permDbHasTable($pdo, 'app_users')) {
            $stmt = $pdo->query('SELECT id, username, role FROM app_users ORDER BY username');
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        // seznam modulů – preferujeme app_modules, ale umíme i čistý FS fallback
        $modules = [];
        try {
            if (permDbHasTable($pdo, 'app_modules')) {
                try {
                    $stmt = $pdo->query(
                        'SELECT id, name, category, sort_order 
                         FROM app_modules 
                         ORDER BY sort_order, id'
                    );
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $modules[] = [
                            'id'       => (string) ($row['id'] ?? ''),
                            'name'     => (string) ($row['name'] ?? ($row['id'] ?? '')),
                            'category' => $row['category'] ?? null,
                            'order'    => (int) ($row['sort_order'] ?? 0),
                        ];
                    }
                } catch (Throwable $e) {
                    $modules = listAvailableModules();
                }
            } else {
                $modules = listAvailableModules();
            }
        } catch (Throwable $e) {
            $modules = listAvailableModules();
        }

        // matice oprávnění role × modul
        $permissions = [];
        $stmtPerm = null;

        try {
            // nové schéma
            $stmtPerm = $pdo->query('SELECT role, module_id, level FROM app_permissions');
        } catch (Throwable $e) {
            // starší schéma s rights
            try {
                $stmtPerm = $pdo->query('SELECT role, module_id, rights AS level FROM app_permissions');
            } catch (Throwable $e2) {
                $stmtPerm = null;
            }
        }

        if ($stmtPerm) {
            while ($row = $stmtPerm->fetch(PDO::FETCH_ASSOC)) {
                $r      = (string) ($row['role'] ?? 'user');
                $module = (string) ($row['module_id'] ?? '');
                if ($module === '') {
                    continue;
                }
                if (!isset($permissions[$r])) {
                    $permissions[$r] = [];
                }
                $permissions[$r][$module] = (string) ($row['level'] ?? 'none');
            }
        }

        jsonResponse([
            'success'     => true,
            'users'       => $users,
            'modules'     => $modules,
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
    $input       = json_decode(file_get_contents('php://input'), true);
    $permissions = is_array($input['permissions'] ?? null) ? $input['permissions'] : null;

    if ($permissions === null) {
        jsonResponse([
            'success' => false,
            'message' => 'Neplatný payload – očekáván objekt \"permissions\".',
        ], 400);
    }

    try {
        $pdo->beginTransaction();

        // přepisujeme celou tabulku
        $pdo->exec('DELETE FROM app_permissions');

        $stmtInsert = $pdo->prepare(
            'INSERT INTO app_permissions (role, module_id, level) VALUES (:role, :module_id, :level)'
        );

        foreach ($permissions as $roleKey => $modules) {
            if (!is_array($modules)) {
                continue;
            }
            foreach ($modules as $moduleId => $level) {
                if ($moduleId === '' || $level === null || $level === 'none') {
                    continue;
                }
                $stmtInsert->execute([
                    ':role'      => (string) $roleKey,
                    ':module_id' => (string) $moduleId,
                    ':level'     => (string) $level,
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

