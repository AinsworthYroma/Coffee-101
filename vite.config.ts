import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const codespaceName = process.env.CODESPACE_NAME
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
const inCodespace = Boolean(codespaceName && forwardingDomain)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'codespace-forwarded-host',
      configureServer(server) {
        if (!inCodespace) return
        server.httpServer?.on('listening', () => {
          const address = server.httpServer?.address()
          if (address && typeof address !== 'string' && Array.isArray(server.config.server.allowedHosts)) {
            server.config.server.allowedHosts.push(`${codespaceName}-${address.port}.${forwardingDomain}`)
          }
        })
      },
    },
  ],
  server: inCodespace ? { host: '127.0.0.1' } : undefined,
})