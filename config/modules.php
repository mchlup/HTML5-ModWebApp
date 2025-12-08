<?php
session_start();

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/app_utils.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$role = $_SESSION['role'] ?? 'guest';
$isAuthenticated = !empty($_SESSION['username'] ?? '');

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
        // generický fallback
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
            $r = (string) ($row['role'] ?? 'user');
            $moduleId = (string) ($row['module_id'] ?? '');
            $level = (string) ($row['level'] ?? 'none');
            if ($moduleId === '') {
                continue;
            }
            if (!isset($permissions[$r])) {
                $permissions[$r] = [];
            }
            $permissions[$r][$moduleId] = $level;
        }
        return $permissions;
    } catch (Throwable $e) {
        // fallback pro starší struktury tabulky
        try {
            $stmt = $pdo->query('SELECT role, module_id, rights FROM app_permissions');
            $permissions = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $r = (string) ($row['role'] ?? 'user');
                $moduleId = (string) ($row['module_id'] ?? '');
                $level = (string) ($row['rights'] ?? 'none');
                if ($moduleId === '') {
                    continue;
                }
                if (!isset($permissions[$r])) {
                    $permissions[$r] = [];
                }
                $permissions[$r][$moduleId] = $level;
            }
            return $permissions;
        } catch (Throwable $e2) {
            return [];
        }
    }
}

/**
 * Vrátí fallback konfiguraci modulů jen podle obsahu složky /modules
 * (všechny nalezené moduly povoleny, super-admin má full přístup).
 */
function respondWithFallbackModules(bool $dbAvailable = false): void
{
    $mods = listAvailableModules();
    $enabled = array_map(static fn(array $m) => (string) $m['id'], $mods);

    jsonResponse([
        'success'        => true,
        'modules'        => $mods,
        'enabledModules' => $enabled,
        'permissions'    => ['super-admin' => ['*' => 'full']],
        'dbAvailable'    => $dbAvailable,
    ]);
}

// Připojení k DB – nevadí, když selže, jen přepneme do fallbacku
$pdo = null;
$dbAvailable = false;
try {
    $pdo = getDbConnection();
    $dbAvailable = $pdo instanceof PDO;
} catch (Throwable $e) {
    $pdo = null;
    $dbAvailable = false;
}

/**
 * GET = načtení seznamu modulů a runtime konfigurace
 */
if ($method === 'GET') {
    // Základ – moduly z FS
    $available = listAvailableModules();
    $availableById = [];
    foreach ($available as $item) {
        $availableById[(string) $item['id']] = $item;
    }

    $modules     = $available;
    $enabled     = array_map(static fn(array $m) => (string) $m['id'], $available);
    $permissions = [];
    $usedDb      = false;

    // Pokud je uživatel přihlášen a DB je k dispozici, zkusíme stáhnout konfiguraci z DB
    if ($isAuthenticated && $dbAvailable && $pdo instanceof PDO && dbHasTable($pdo, 'app_modules')) {
        try {
            try {
                $stmt = $pdo->query('SELECT id, name, enabled, category, sort_order, description, version FROM app_modules');
            } catch (Throwable $e) {
                // fallback na starší schéma
                $stmt = $pdo->query('SELECT id, name, enabled, category, sort_order FROM app_modules');
            }

            $modules = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $id       = (string) $row['id'];
                $fallback = $availableById[$id] ?? [];

                $modules[] = [
                    'id'          => $id,
                    'name'        => (string) ($row['name'] ?? ($fallback['name'] ?? $id)),
                    'description' => $row['description'] ?? ($fallback['description'] ?? null),
                    'version'     => $row['version'] ?? ($fallback['version'] ?? null),
                    'category'    => $row['category'] ?? ($fallback['category'] ?? null),
                    'order'       => (int) ($row['sort_order'] ?? ($fallback['order'] ?? 0)),
                    'enabled'     => (bool) ($row['enabled'] ?? 0),
                ];
            }

            $enabled = array_values(array_filter(array_map(
                static function (array $m) {
                    return !empty($m['enabled']) ? (string) $m['id'] : null;
                },
                $modules
            )));

            if (dbHasTable($pdo, 'app_permissions')) {
                $permissions = fetchPermissions($pdo);
            } else {
                $permissions = [];
            }

            $usedDb = true;
        } catch (Throwable $e) {
            // pokud cokoliv z DB selže, spadneme zpět na čistý FS fallback
            $modules     = $available;
            $enabled     = array_map(static fn(array $m) => (string) $m['id'], $available);
            $permissions = [];
            $usedDb      = false;
        }
    }

    // Super-admin bez funkční DB musí pořád vidět vše
    if ($isAuthenticated && $role === 'super-admin' && (!$dbAvailable || !$usedDb)) {
        $modules     = $available;
        $enabled     = array_map(static fn(array $m) => (string) $m['id'], $available);
        $permissions = ['super-admin' => ['*' => 'full']];
    }

    // Pokud nic nevyšlo z DB, snažíme se respektovat defaultEnabledModules z app.json
    if (!$enabled) {
        $appDefinition = loadAppDefinition();
        $defaultEnabled = array_values(array_filter(
            $appDefinition['defaultEnabledModules'] ?? [],
            static fn($id) => isset($availableById[(string) $id])
        ));
        if (!$defaultEnabled) {
            $defaultEnabled = array_map(static fn(array $m) => (string) $m['id'], $available);
        }
        $enabled = $defaultEnabled;
    }

    jsonResponse([
        'success'        => true,
        'modules'        => $modules,
        'enabledModules' => array_values(array_unique($enabled)),
        'permissions'    => $permissions,
        'dbAvailable'    => $dbAvailable,
    ]);
}

/**
 * POST = uložení seznamu povolených modulů do DB
 */
if ($method === 'POST') {
    // změny konfigurace modulů smí dělat jen přihlášený uživatel
    ensureLoggedIn();

    // Super-admin může ukládat i bez CSRF, ostatní musí mít platný token
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

    $payload        = json_decode(file_get_contents('php://input'), true) ?? [];
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

        foreach ($available as $module) {
            $id = (string) $module['id'];

            // Nejdřív zkusíme update
            $update = $pdo->prepare(
                'UPDATE app_modules 
                 SET name = ?, category = ?, sort_order = ?, enabled = ? 
                 WHERE id = ?'
            );
            $update->execute([
                $module['name'] ?? $id,
                $module['category'] ?? null,
                $module['order'] ?? 0,
                in_array($id, $enabledModules, true) ? 1 : 0,
                $id,
            ]);

            // Když se nic neaktualizovalo, vložíme nový záznam
            if ($update->rowCount() === 0) {
                $insert = $pdo->prepare(
                    'INSERT INTO app_modules (id, name, category, sort_order, enabled) 
                     VALUES (?, ?, ?, ?, ?)'
                );
                $insert->execute([
                    $id,
                    $module['name'] ?? $id,
                    $module['category'] ?? null,
                    $module['order'] ?? 0,
                    in_array($id, $enabledModules, true) ? 1 : 0,
                ]);
            }
        }

        $pdo->commit();

        // Znovu načteme povolené moduly z DB
        $enabled = [];
        try {
            $stmt    = $pdo->query('SELECT id FROM app_modules WHERE enabled = 1');
            $enabled = $stmt->fetchAll(PDO::FETCH_COLUMN, 0) ?: [];
        } catch (Throwable $e) {
            $enabled = $enabledModules;
        }

        jsonResponse([
            'success'        => true,
            'enabledModules' => array_values(array_unique($enabled)),
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonResponse([
            'success' => false,
            'message' => 'Uložení konfigurace modulů se nezdařilo.',
        ], 500);
    }
}

// cokoliv jiného než GET/POST
jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);
