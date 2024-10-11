import { build } from 'esbuild';
import { copyFile } from 'fs';
import { esbuildDecorators } from 'esbuild-plugin-typescript-decorators';

(async () => {
    const zipName = process.env.ZIP_NAME || 'tsk-cert-gen';

    await build({
        entryPoints: ['src/handler.ts'],
        outfile: `${zipName}/handler.js`,
        bundle: true,
        minify: true,
        sourcemap: process.argv.includes('--source-map'),
        logLevel: 'info',
        platform: 'node',
        plugins: [esbuildDecorators()],
    });

    copyFile('src/config/config.yml', `${zipName}/config.yml`, (err) => {
        if (err) {
            console.error('Error copying config.yml:', err);
        }
    });
})();
