<?php
// Dynamické generování seznamu modulů na základě adresáře /modules.
// Vrací JSON ve tvaru:
// { "modules": [ { "id": "crm", "entry": "./modules/crm/index.js" }, ... ] }

header('Content-Type: application/json; charset=utf-8');

$baseDir    = __DIR__ . '/..';
$modulesDir = $baseDir . '/modules';

$result = [
    'modules' => []
];

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

    // Podmínka: modul má mít alespoň index.js
    $indexJs = $full . '/index.js';
    if (!file_exists($indexJs)) {
        continue;
    }

    // ID modulu je název složky
    $id = $name;

    $result['modules'][] = [
        'id'    => $id,
        'entry' => "./modules/{$id}/index.js"
    ];
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
