import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
export default defineConfig({
plugins: [basicSsl()],
base: '/CircuitCircuit/',
build:{
    outDir:'dist'
},
server: {
    https: true,
    host: true
}
});