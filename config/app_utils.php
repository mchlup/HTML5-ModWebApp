<?php

function loadAppDefinition(string $path = __DIR__ . '/app.json'): array
{
    $fallback = [
        'superAdmin' => [
            'username' => 'admin',
            'passwordHash' => password_hash('admin', PASSWORD_DEFAULT),
            'enabledOfflineLogin' => true,
            'allowFallbackWithoutDb' => true,
        ],
        'defaultEnabledModules' => ['dashboard', 'config'],
    ];

    if (!file_exists($path)) {
        return $fallback;
    }

    $json = json_decode(file_get_contents($path), true);
    if (!is_array($json)) {
        return $fallback;
    }

    return array_replace_recursive($fallback, $json);
}

function listAvailableModules(?string $dir = null): array
{
    $modules = [];
    $dir = $dir ?: __DIR__ . '/../modules';
    $definition = loadAppDefinition();
    $moduleOverrides = is_array($definition['modules'] ?? null) ? $definition['modules'] : [];

    if (!is_dir($dir)) {
        return $modules;
    }

    foreach (scandir($dir) as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }

        $path = $dir . '/' . $name;
        if (is_dir($path) && file_exists($path . '/index.js')) {
            $manifest = [
                'id' => (string) $name,
                'name' => ucfirst(str_replace(['-', '_'], ' ', (string) $name)),
                'category' => null,
                'order' => 0,
                'enabled' => true,
            ];

            $overrides = is_array($moduleOverrides[$name] ?? null) ? $moduleOverrides[$name] : [];

            $configPath = $path . '/config.json';
            if (file_exists($configPath)) {
                $json = json_decode(file_get_contents($configPath), true);
                if (is_array($json)) {
                    if (isset($json['name'])) {
                        $manifest['name'] = (string) $json['name'];
                    }
                    if (isset($json['description'])) {
                        $manifest['description'] = (string) $json['description'];
                    }
                    if (isset($json['version'])) {
                        $manifest['version'] = (string) $json['version'];
                    }
                    if (isset($json['category'])) {
                        $manifest['category'] = $json['category'];
                    }
                }
            }

            if (isset($overrides['name'])) {
                $manifest['name'] = (string) $overrides['name'];
            }
            if (isset($overrides['description'])) {
                $manifest['description'] = (string) $overrides['description'];
            }

            $modules[] = $manifest;
        }
    }

    usort($modules, static function (array $a, array $b) {
        return ($a['order'] ?? 0) <=> ($b['order'] ?? 0) ?: strcmp($a['id'], $b['id']);
    });

    return $modules;
}
