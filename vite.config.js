import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
export default defineConfig({
plugins: [basicSsl()],
server: {
    https: {
         key:  fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    },
    host: true
}
});