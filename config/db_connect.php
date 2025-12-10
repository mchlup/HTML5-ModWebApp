<?php
// Funkce pro získání PDO připojení k databázi pomocí konfigurace uložené po provedení nastavení
// Cestu ke konfiguraci lze přepsat konstantou DB_CONFIG_PATH nebo proměnnou prostředí DB_CONFIG_PATH
if (!defined('DB_CONFIG_PATH')) {
    $envPath = getenv('DB_CONFIG_PATH');
    define('DB_CONFIG_PATH', $envPath !== false ? $envPath : __DIR__ . '/db_config.json');
}

function getDbConnection(): PDO {
    $configPath = DB_CONFIG_PATH;
    if (!file_exists($configPath)) {
        throw new RuntimeException('Konfigurace databáze není nastavena.');
    }
    $conf = json_decode(file_get_contents($configPath), true);
    if (!$conf || !isset($conf['driver'])) {
        throw new RuntimeException('Konfigurace databáze není platná.');
    }
    $driver = strtolower($conf['driver']);
    $host = $conf['host'] ?? 'localhost';
    $port = $conf['port'] ?? ($driver === 'mysql' ? 3306 : ($driver === 'sqlite' ? 0 : 5432));
    $database = $conf['database'] ?? '';
    $username = $conf['username'] ?? '';
    $password = $conf['password'] ?? '';
    $ssl = !empty($conf['ssl']);

    if ($driver !== 'sqlite' && $database === '') {
        throw new RuntimeException('Není nastaven název databáze.');
    }

    $dsn = '';
    if ($driver === 'mysql') {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port ?: 3306, $database);
    } elseif ($driver === 'postgres') {
        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s%s', $host, $port ?: 5432, $database, $ssl ? ';sslmode=require' : '');
    } elseif ($driver === 'sqlite') {
        $path = $database !== '' ? $database : ':memory:';
        $dsn = 'sqlite:' . $path;
        $username = null;
        $password = null;
    } else {
        throw new RuntimeException('Nepodporovaný databázový driver.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
    return new PDO($dsn, $username, $password, $options);
}
