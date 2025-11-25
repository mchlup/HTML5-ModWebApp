<?php
session_start();

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Základní kontrola přihlášení
ensureLoggedIn();

/**
 * Vrátí seznam dostupných modulů podle složek v /modules.
 * Používá se jako fallback, např. pro super-admina na čerstvé instalaci
 * nebo při nefunkční databázi.
 */
function listAvailableModules(): array
{
    $modules = [];
    $dir = __DIR__ . '/../modules';

    if (!is_dir($dir)) {
        return $modules;
    }

    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }

        $path = $dir . '/' . $name;
        if (is_dir($path) && file_exists($path . '/index.js')) {
            $modules[] = [
                'id'      => (string) $name,
                'name'    => ucfirst((string) $name),
                // pole "enabled" je volitelné – používá se hlavně u DB varianty,
                // u fallbacku je super-adminovi stejně vše povoleno
                'enabled' => true,
            ];
        }
    }

    return $modules;
}

$pdo = null;
$dbAvailable = false;

// Pokus o připojení k databázi
try {
    $pdo = getDbConnection();
    $dbAvailable = true;
} catch (Throwable $e) {
    $dbAvailable = false;
}

// GET – načtení manifestu modulů
if ($method === 'GET') {
    $modules = [];
    $enabled = [];

    // 1) Pokus o načtení z databáze
    if ($dbAvailable && $pdo instanceof PDO) {
        try {
            $stmt = $pdo->query('SELECT id, name, enabled FROM app_modules');
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $modules[] = [
                    'id'      => (string) $row['id'],
                    'name'    => (string) $row['name'],
                    'enabled' => (bool) $row['enabled'],
                ];
            }
        } catch (Throwable $e) {
            // Chyba v dotazu / neexistující tabulka -> považuj DB za nepoužitelnou
            $modules = [];
            $dbAvailable = false;
        }

        if ($dbAvailable && !empty($modules)) {
            // Seznam povolených modulů = ID modulů s enabled = true
            $enabled = array_values(
                array_filter(
                    array_map(
                        static function (array $m) {
                            if (!empty($m['enabled'])) {
                                return (string) $m['id'];
                            }
                            return null;
                        },
                        $modules
                    ),
                    static function ($v) {
                        return $v !== null && $v !== '';
                    }
                )
            );

            jsonResponse([
                'success'        => true,
                'modules'        => $modules,
                'enabledModules' => $enabled,
                'permissions'    => [], // detailní práva řeší permissions.php
            ]);
        }
    }

    // 2) Fallback – super-admin nikdy nesmí skončit s prázdným manifestem
    //    Použije se při:
    //    - nefunkční / nepřipravené DB
    //    - funkční DB, ale prázdná/rozbitá tabulka app_modules
    if (($_SESSION['role'] ?? '') === 'super-admin') {
        $mods = listAvailableModules();
        $enabled = array_map(
            static function (array $m) {
                return (string) $m['id'];
            },
            $mods
        );

        jsonResponse([
            'success'        => true,
            'modules'        => $mods,
            'enabledModules' => $enabled,
            // Super-admin má efektivně plná práva; permissionService stejně používá roli
            'permissions'    => ['*' => 'manage'],
        ]);
    }

    // 3) Pro ostatní role, když není připraven backend, vrátíme chybu
    jsonResponse(
        [
            'success' => false,
            'message' => 'Moduly nelze načíst – backend není nakonfigurován. Přihlaste se jako super-admin a dokončete nastavení.',
        ],
        503
    );
}

// POST – uložení seznamu povolených modulů
if ($method === 'POST') {
    requireCsrfToken();

    if (!$dbAvailable || !$pdo instanceof PDO) {
        jsonResponse(
            [
                'success' => false,
                'message' => 'Uložení konfigurace modulů bez funkční databáze není možné.',
            ],
            503
        );
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $enabled = is_array($data['enabledModules'] ?? null) ? $data['enabledModules'] : [];

    try {
        $pdo->exec('UPDATE app_modules SET enabled = 0');

        $stmt = $pdo->prepare('UPDATE app_modules SET enabled = 1 WHERE id = ?');
        foreach ($enabled as $id) {
            $stmt->execute([(string) $id]);
        }
    } catch (Throwable $e) {
        jsonResponse(
            [
                'success' => false,
                'message' => 'Uložení se nezdařilo.',
            ],
            500
        );
    }

    jsonResponse(['success' => true]);
}

// Ostatní metody
jsonResponse(['success' => false, 'message' => 'Nepodporovaná metoda.'], 405);

