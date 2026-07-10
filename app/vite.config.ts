import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import path from 'path';

export default defineConfig({
    plugins: [TanStackRouterVite(), tailwindcss(), react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shiron/ui': path.resolve(__dirname, '../packages/ui/src'),
        },
    },
    server: {
        port: 60605
    },
});
