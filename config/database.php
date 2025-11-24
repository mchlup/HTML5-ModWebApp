<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$input = json_decode(file_get_contents('php://input'), true);
$action = isset($input['action']) ? $input['action'] : null;
$config = isset($input['config']) && is_array($input['config']) ? $input['config'] : [];

$dbConfigPath = __DIR__ . '/db_config.json';
$configExists = file_exists($dbConfigPath);
$isSuperAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'super-admin';

if ($configExists && !$isSuperAdmin) {
    respond(['success' => false, 'message' => 'Nedostatečná oprávnění.'], 403);
}

try {
    if (!$action) {
        throw new InvalidArgumentException('Nebyla specifikována akce.');
    }
    $driver = isset($config['driver']) ? strtolower((string)$config['driver']) : 'postgres';
    if (!in_array($driver, ['postgres', 'mysql', 'sqlite'], true)) {
        throw new InvalidArgumentException('Nepodporovaný databázový driver.');
    }

    if ($configExists === false || $isSuperAdmin || $action === 'test') {
        if ($action === 'test') {
            $pdo = createPdo($config, $driver);
            $pdo->query('SELECT 1');
            respond(['success' => true, 'message' => 'Spojení s databází funguje.']);
        }

        if ($action === 'provision') {
            $pdo = createPdo($config, $driver);
            provisionSchema($pdo, $driver);

            $appConfigPath = __DIR__ . '/app.json';
            $defaultAdmin = ['username' => 'admin', 'password' => 'admin'];
            $defaultModules = [];
            if (file_exists($appConfigPath)) {
                $appCfg = json_decode(file_get_contents($appConfigPath), true);
                if (!empty($appCfg['superAdmin'])) {
                    if (!empty($appCfg['superAdmin']['username'])) {
                        $defaultAdmin['username'] = $appCfg['superAdmin']['username'];
                    }
                    if (!empty($appCfg['superAdmin']['password'])) {
                        $defaultAdmin['password'] = $appCfg['superAdmin']['password'];
                    }
                }
                if (!empty($appCfg['defaultEnabledModules']) && is_array($appCfg['defaultEnabledModules'])) {
                    $defaultModules = $appCfg['defaultEnabledModules'];
                }
            }

            $countStmt = $pdo->query('SELECT COUNT(*) FROM app_users');
            $userCount = (int)$countStmt->fetchColumn();
            if ($userCount === 0) {
                $hash = password_hash($defaultAdmin['password'], PASSWORD_DEFAULT);
                $insertUser = $pdo->prepare('INSERT INTO app_users (username, password, role) VALUES (?, ?, ?)');
                $insertUser->execute([$defaultAdmin['username'], $hash, 'super-admin']);
            }

            $modCountStmt = $pdo->query('SELECT COUNT(*) FROM app_modules');
            $modCount = (int)$modCountStmt->fetchColumn();
            if ($modCount === 0) {
                if (empty($defaultModules)) {
                    $moduleDir = __DIR__ . '/../modules';
                    if (is_dir($moduleDir)) {
                        foreach (scandir($moduleDir) as $name) {
                            if ($name === '.' || $name === '..') {
                                continue;
                            }
                            if (is_dir($moduleDir . '/' . $name)) {
                                $defaultModules[] = $name;
                            }
                        }
                    }
                }
                foreach ($defaultModules as $modId) {
                    $stmt = $pdo->prepare('INSERT INTO app_modules (id, enabled) VALUES (?, 1)');
                    $stmt->execute([$modId]);
                }
            }

            file_put_contents($dbConfigPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            respond([
                'success' => true,
                'message' => 'Schéma bylo ověřeno a tabulky jsou připravené.',
            ]);
        }
    }

    throw new InvalidArgumentException('Neznámá akce.');
} catch (Throwable $e) {
    $msg = $configExists ? 'Operace selhala.' : $e->getMessage();
    respond([
        'success' => false,
        'message' => $msg,
    ], $configExists ? 500 : 400);
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function createPdo(array $config, string $driver): PDO
{
    $host = trim((string)($config['host'] ?? 'localhost'));
    $port = (int)($config['port'] ?? ($driver === 'mysql' ? 3306 : ($driver === 'sqlite' ? 0 : 5432)));
    $database = trim((string)($config['database'] ?? ''));
    $username = (string)($config['username'] ?? '');
    $password = (string)($config['password'] ?? '');
    $ssl = !empty($config['ssl']);

    if ($driver !== 'sqlite' && $database === '') {
        throw new InvalidArgumentException('Musíte zadat název databáze.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    switch ($driver) {
        case 'postgres':
            $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s%s',
                $host,
                $port ?: 5432,
                $database,
                $ssl ? ';sslmode=require' : ''
            );
            break;
        case 'mysql':
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $host,
                $port ?: 3306,
                $database
            );
            break;
        case 'sqlite':
            $path = $database !== '' ? $database : ':memory:';
            $dsn = 'sqlite:' . $path;
            $username = null;
            $password = null;
            break;
        default:
            throw new InvalidArgumentException('Nepodporovaný driver.');
    }

    try {
        return new PDO($dsn, $username, $password, $options);
    } catch (PDOException $e) {
        throw new RuntimeException('Nepodařilo se připojit: ' . $e->getMessage(), 0, $e);
    }
}

function provisionSchema(PDO $pdo, string $driver): void
{
    $statements = [];

    if ($driver === 'sqlite') {
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT "user"
        )';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            module_id TEXT NOT NULL,
            rights TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES app_users(id)
        )';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_modules (
            id TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 0
        )';
    } elseif ($driver === 'mysql') {
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_users (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            username VARCHAR(191) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT "user",
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_permissions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            module_id VARCHAR(120) NOT NULL,
            rights VARCHAR(20) NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT fk_app_permissions_user FOREIGN KEY (user_id)
                REFERENCES app_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_modules (
            id VARCHAR(120) NOT NULL,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    } else {
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_users (
            id BIGSERIAL PRIMARY KEY,
            username VARCHAR(191) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT \'user\'
        )';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_permissions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            module_id VARCHAR(120) NOT NULL,
            rights VARCHAR(20) NOT NULL
        )';
        $statements[] = 'CREATE TABLE IF NOT EXISTS app_modules (
            id VARCHAR(120) PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT FALSE
        )';
    }

    $pdo->beginTransaction();
    try {
        foreach ($statements as $sql) {
            $pdo->exec($sql);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw new RuntimeException('Provision selhal: ' . $e->getMessage(), 0, $e);
    }
}
