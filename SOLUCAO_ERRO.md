# Solução para Erro "Unable to resolve socket.io-client"

## Passos para resolver:

### 1. Parar todos os servidores
- Pare o servidor Expo/Metro (Ctrl+C)
- Pare o servidor WebSocket se estiver rodando

### 2. Limpar cache e reinstalar
```bash
# Limpar cache do npm
npm cache clean --force

# Remover node_modules e package-lock.json
rm -rf node_modules package-lock.json

# No Windows PowerShell:
# Remove-Item -Recurse -Force node_modules
# Remove-Item package-lock.json

# Reinstalar dependências
npm install
```

### 3. Limpar cache do Expo/Metro
```bash
# Iniciar Expo com cache limpo
npx expo start --clear

# Ou se preferir usar o npm script:
npm start -- --clear
```

### 4. Se ainda não funcionar, verificar se o módulo está instalado:
```bash
npm list socket.io-client
```

Deve mostrar: `socket.io-client@4.8.3`

### 5. Alternativa: Verificar se precisa de configuração adicional

Se ainda não funcionar, pode ser necessário criar um arquivo `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Adicionar resoluções para socket.io-client
config.resolver.sourceExts.push('cjs');

module.exports = config;
```

Mas geralmente isso não é necessário para Expo.

### 6. Última alternativa: Usar versão específica

Se nada funcionar, tente usar uma versão específica conhecida por funcionar:

```bash
npm install socket.io-client@4.7.2 --save
```

