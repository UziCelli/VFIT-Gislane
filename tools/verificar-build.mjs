// Falha fechado antes de publicar arquivos internos ou credenciais reconhecíveis.
// Não substitui varredura de histórico nem rotação de segredos.
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
const raiz = process.argv[2] || 'dist'
const falhas = []
async function conferir(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    const nome = relative(raiz, path)
    if (item.isSymbolicLink()) {
      falhas.push(nome)
    } else if (item.isDirectory()) {
      if (item.name.startsWith('.') && item.name !== '.well-known') falhas.push(nome)
      await conferir(path)
    } else {
      if (/^\.env(?:\.|$)|\.(?:map|pem|key|p12|pfx|db|sqlite\d*|sql|bak|xlsx)$/i.test(item.name)) falhas.push(nome)
      if (/\.(?:js|json|html|css|txt)$/i.test(item.name)) {
        const texto = await readFile(path, 'utf8')
        if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-ant-[A-Za-z0-9_-]{20,}|"type"\s*:\s*"service_account"/.test(texto)) falhas.push(nome)
      }
    }
  }
}
await conferir(raiz)
if (falhas.length) {
  // Só caminhos; nunca imprimir o conteúdo potencialmente sensível.
  console.error('Build bloqueado: revisar arquivos internos/credenciais:', [...new Set(falhas)].join(', '))
  process.exitCode = 1
} else console.log('Build verificado: sem arquivos internos ou credenciais reconhecidas.')
