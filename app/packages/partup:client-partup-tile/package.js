Package.describe({
    name: 'partup:client-partup-tile',
    version: '0.0.1',
    summary: '',
    documentation: null
});

Package.onUse(function(api) {
    api.use([
        'tap:i18n'
    ], ['client', 'server']);

    api.use([
        'templating',
        'partup:lib',
        'reactive-dict'
    ], 'client');

    api.addFiles([
        'package-tap.i18n',

        'helpers.js',

        'PartupTile.html',
        'PartupTile.js',

        'PartupTileFeatured.html',
        'PartupTileFeatured.js',

        'i18n/en.i18n.json',
        'i18n/nl.i18n.json'
    ], 'client');
});
