# Servidor WebSocket - Fodinha Multiplayer

Servidor WebSocket usando Socket.io para o jogo Fodinha multiplayer.

## Instalação

```bash
cd server
npm install
```

## Executar

```bash
# Produção
npm start

# Desenvolvimento (com nodemon)
npm run dev
```

O servidor rodará na porta 3001 por padrão (ou na porta definida pela variável de ambiente PORT).

## Funcionalidades

- Criação de salas
- Entrada em salas existentes
- Listagem de salas disponíveis
- Iniciar jogo (apenas host)
- Sincronização de jogadas
- Gerenciamento de estado do jogo
- Sistema de host (primeiro jogador é o host)

## Eventos Socket.io

### Cliente -> Servidor
- `criar-sala`: Criar nova sala
- `entrar-sala`: Entrar em sala existente
- `listar-salas`: Listar salas disponíveis
- `iniciar-jogo`: Iniciar o jogo (apenas host)
- `jogar-carta`: Jogar uma carta
- `fazer-aposta`: Fazer aposta
- `atualizar-estado`: Atualizar estado do jogo (apenas host)
- `atualizar-mao`: Atualizar mão do jogador
- `sair-sala`: Sair da sala

### Servidor -> Cliente
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
