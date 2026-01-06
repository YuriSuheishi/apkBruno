# Fodinha RN - Jogo de Cartas Multiplayer

Jogo de cartas Fodinha desenvolvido em React Native/Expo com suporte a multiplayer via WebSockets.

## Funcionalidades

- ✅ Jogo single-player com bots
- ✅ Multiplayer online via WebSocket
- ✅ Sistema de salas (criar, entrar, listar)
- ✅ Integração com Deck of Cards API para embaralhamento e imagens
- ✅ Baralho personalizado (sem 8, 9, 10 e coringas)

## Instalação

### Frontend (React Native/Expo)

```bash
# Instalar dependências
npm install

# Executar o app
npm start
```

### Backend (Servidor WebSocket)

```bash
# Ir para a pasta do servidor
cd server

# Instalar dependências
npm install

# Executar o servidor
npm start

# Ou em modo desenvolvimento (com auto-reload)
npm run dev
```

O servidor rodará na porta 3001 por padrão.

## Configuração

### URL do Servidor

No arquivo `components/SalaManager.js`, atualize a constante `SERVER_URL`:

```javascript
const SERVER_URL = __DEV__ 
  ? 'http://localhost:3001'  // Desenvolvimento
  : 'https://seu-servidor.com'; // Produção - substitua pela URL do seu servidor
```

**Importante**: Para usar em dispositivos móveis reais, você precisará:

1. **Android Emulator**: Use `http://10.0.2.2:3001` em vez de `localhost`
2. **iOS Simulator**: Use `http://localhost:3001`
3. **Dispositivo físico**: Use o IP local da sua máquina (ex: `http://192.168.1.100:3001`)

## Como Jogar

### Single Player

1. Abra o app
2. Selecione "Jogar Solo (com Bots)"
3. O jogo iniciará automaticamente com bots

### Multiplayer

1. Abra o app
2. Selecione "Multiplayer Online"
3. Digite seu nome
4. Escolha uma opção:
   - **Criar Sala**: Crie uma nova sala e compartilhe o ID
   - **Entrar na Sala**: Digite o ID da sala para entrar
   - **Listar Salas**: Veja salas disponíveis e entre em uma
5. Aguarde outros jogadores (mínimo 2 jogadores)
6. O host pode iniciar o jogo quando houver jogadores suficientes

## Estrutura do Projeto

```
tenacious-blue-banana/
├── App.js                 # Componente principal do jogo
├── components/
│   └── SalaManager.js     # Gerenciamento de salas multiplayer
├── server/
│   ├── server.js          # Servidor WebSocket (Socket.io)
│   ├── package.json
│   └── README.md
├── package.json
└── README.md
```

## Tecnologias Utilizadas

- **Frontend**: React Native, Expo
- **Backend**: Node.js, Socket.io
- **API Externa**: [Deck of Cards API](https://deckofcardsapi.com/)
- **WebSocket**: Socket.io para comunicação em tempo real

## Eventos WebSocket

### Cliente → Servidor

- `criar-sala`: Criar nova sala
- `entrar-sala`: Entrar em sala existente
- `listar-salas`: Listar salas disponíveis
- `iniciar-jogo`: Iniciar o jogo (apenas host)
- `jogar-carta`: Jogar uma carta
- `fazer-aposta`: Fazer aposta
- `atualizar-estado`: Atualizar estado do jogo (apenas host)
- `atualizar-mao`: Atualizar mão do jogador
- `sair-sala`: Sair da sala

### Servidor → Cliente

- `sala-criada`: Sala criada com sucesso
- `entrou-sala`: Entrou na sala com sucesso
- `salas-disponiveis`: Lista de salas disponíveis
- `jogador-entrou`: Novo jogador entrou na sala
- `jogador-saiu`: Jogador saiu da sala
- `jogo-iniciado`: Jogo foi iniciado
- `carta-jogada`: Carta foi jogada
- `aposta-feita`: Aposta foi feita
- `estado-atualizado`: Estado do jogo foi atualizado
- `tornou-host`: Jogador se tornou host
- `erro`: Erro ocorreu

## Deploy

### Servidor

Para produção, você pode fazer deploy do servidor em plataformas como:
- Heroku
- Railway
- Render
- DigitalOcean
- AWS EC2

Lembre-se de atualizar a `SERVER_URL` no frontend após o deploy.

### Frontend

O frontend pode ser publicado via Expo:
- Expo Go (desenvolvimento)
- Expo EAS Build (produção)
- Standalone builds

## Notas

- O baralho usado não inclui os números 8, 9, 10 nem coringas (conforme solicitado)
- O sistema de salas suporta até 4 jogadores
- O primeiro jogador a criar/entrar na sala se torna o host
- O host tem controle para iniciar o jogo