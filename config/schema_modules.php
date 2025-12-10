<?php

require_once __DIR__ . '/db_connect.php';

function modulesTableExists(PDO $pdo): bool
{
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
            $stmt->execute(['app_modules']);
            return (bool) $stmt->fetchColumn();
        }
        if ($driver === 'sqlite') {
            $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
            $stmt->execute(['app_modules']);
            return (bool) $stmt->fetchColumn();
        }
        $pdo->query('SELECT 1 FROM app_modules LIMIT 1');
        return true;
    } catch (Throwable $e) {
        return false;
    }
}

function getModulesTableColumns(PDO $pdo): array
{
    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $stmt = $pdo->query("SHOW COLUMNS FROM app_modules");
            $columns = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[strtolower((string) $row['Field'])] = $row;
            }
            return $columns;
        }
        if ($driver === 'sqlite') {
            $stmt = $pdo->query("PRAGMA table_info('app_modules')");
            $columns = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $columns[strtolower((string) $row['name'])] = $row;
            }
            return $columns;
        }
    } catch (Throwable $e) {
        return [];
    }

    return [];
}

function ensureModulesTableSchema(PDO $pdo): void
{
    $requiredColumns = [
        'id' => 'VARCHAR(190) NOT NULL',
        'name' => 'VARCHAR(255) NULL',
        'enabled' => 'TINYINT(1) DEFAULT 0',
        'category' => 'VARCHAR(100) NULL',
        'sort_order' => 'INT DEFAULT 0',
        'description' => 'TEXT NULL',
        'version' => 'VARCHAR(50) NULL',
    ];

    if (!modulesTableExists($pdo)) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS app_modules (
                id VARCHAR(190) PRIMARY KEY,
                name VARCHAR(255) NULL,
                enabled TINYINT(1) DEFAULT 0,
                category VARCHAR(100) NULL,
                sort_order INT DEFAULT 0,
                description TEXT NULL,
                version VARCHAR(50) NULL
            )'
        );
        return;
    }

    $columns = getModulesTableColumns($pdo);
    foreach ($requiredColumns as $column => $definition) {
        if (!isset($columns[strtolower($column)])) {
            try {
                $pdo->exec("ALTER TABLE app_modules ADD COLUMN {$column} {$definition}");
            } catch (Throwable $e) {
                error_log('[schema_modules] Nelze přidat sloupec ' . $column . ': ' . $e->getMessage());
            }
        }
    }

    try {
        $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'mysql') {
            $indexes = $pdo->query("SHOW INDEX FROM app_modules WHERE Key_name = 'PRIMARY'");
            if (!$indexes || !$indexes->fetch()) {
                $pdo->exec('ALTER TABLE app_modules ADD PRIMARY KEY (id)');
            }
        } elseif ($driver === 'sqlite') {
            $info = $pdo->query("PRAGMA table_info('app_modules')");
            $hasPrimary = false;
            while ($row = $info->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['pk']) && strtolower((string) $row['name']) === 'id') {
                    $hasPrimary = true;
                    break;
                }
            }
            if (!$hasPrimary) {
                $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_app_modules_id ON app_modules(id)');
            }
        }
    } catch (Throwable $e) {
        error_log('[schema_modules] Kontrola primárního klíče selhala: ' . $e->getMessage());
    }
}
