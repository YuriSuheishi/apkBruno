const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Armazenamento de salas e jogadores
const salas = new Map(); // roomId -> { jogadores: [], estado: {}, host: socketId }

// Função para gerar ID de sala
function gerarIdSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Função para obter informações da sala
function getSalaInfo(roomId) {
  const sala = salas.get(roomId);
  if (!sala) return null;
  
  return {
    id: roomId,
    jogadores: sala.jogadores.map(j => ({
      id: j.id,
      nome: j.nome,
      vidas: j.vidas,
      isHost: j.id === sala.host
    })),
    estado: sala.estado,
    host: sala.host
  };
}

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Criar sala
  socket.on('criar-sala', ({ nome }) => {
    const roomId = gerarIdSala();
    socket.join(roomId);
    
    const jogador = {
      id: socket.id,
      nome: nome || `Jogador ${socket.id.substring(0, 6)}`,
      vidas: 3,
      mao: []
    };

    salas.set(roomId, {
      jogadores: [jogador],
      estado: {
        vira: null,
        manilha: null,
        apostas: {},
        feitas: {},
        jogando: false,
        rodada: 0
      },
      host: socket.id
    });

    socket.emit('sala-criada', { roomId, jogador, sala: getSalaInfo(roomId) });
    console.log(`Sala ${roomId} criada por ${socket.id}`);
  });

  // Entrar em sala
  socket.on('entrar-sala', ({ roomId, nome }) => {
    const sala = salas.get(roomId);
    
    if (!sala) {
      socket.emit('erro', { mensagem: 'Sala não encontrada' });
      return;
    }

    if (sala.jogadores.length >= 4) {
      socket.emit('erro', { mensagem: 'Sala cheia (máximo 4 jogadores)' });
      return;
    }

    if (sala.estado.jogando) {
      socket.emit('erro', { mensagem: 'Jogo já está em andamento' });
      return;
    }

    socket.join(roomId);

    const jogador = {
      id: socket.id,
      nome: nome || `Jogador ${socket.id.substring(0, 6)}`,
      vidas: 3,
      mao: []
    };

    sala.jogadores.push(jogador);
    socket.emit('entrou-sala', { jogador, sala: getSalaInfo(roomId) });
    
    // Notificar outros jogadores
    socket.to(roomId).emit('jogador-entrou', { jogador, sala: getSalaInfo(roomId) });
    console.log(`${socket.id} entrou na sala ${roomId}`);
  });

  // Listar salas disponíveis
  socket.on('listar-salas', () => {
    const salasDisponiveis = Array.from(salas.entries())
      .filter(([id, sala]) => !sala.estado.jogando && sala.jogadores.length < 4)
      .map(([id, sala]) => ({
        id,
        jogadores: sala.jogadores.length,
        maxJogadores: 4
      }));
    
    socket.emit('salas-disponiveis', salasDisponiveis);
  });

  // Iniciar jogo (apenas host)
  socket.on('iniciar-jogo', ({ roomId }) => {
    const sala = salas.get(roomId);
    if (!sala || sala.host !== socket.id) {
      socket.emit('erro', { mensagem: 'Apenas o host pode iniciar o jogo' });
      return;
    }

    if (sala.jogadores.length < 2) {
      socket.emit('erro', { mensagem: 'É necessário pelo menos 2 jogadores' });
      return;
    }

    sala.estado.jogando = true;
    sala.estado.rodada = 1;
    
    // Notificar todos na sala
    io.to(roomId).emit('jogo-iniciado', { sala: getSalaInfo(roomId) });
  });

  // Jogar carta
  socket.on('jogar-carta', ({ roomId, cartaIndex }) => {
    const sala = salas.get(roomId);
    if (!sala) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador || !jogador.mao[cartaIndex]) return;

    const carta = jogador.mao.splice(cartaIndex, 1)[0];
    
    // Notificar todos na sala
    io.to(roomId).emit('carta-jogada', {
      jogadorId: socket.id,
      jogadorNome: jogador.nome,
      carta: carta
    });

    // Atualizar feitas
    if (!sala.estado.feitas[jogador.nome]) {
      sala.estado.feitas[jogador.nome] = 0;
    }
    sala.estado.feitas[jogador.nome]++;

    // Atualizar estado da sala
    io.to(roomId).emit('estado-atualizado', { sala: getSalaInfo(roomId) });
  });

  // Fazer aposta
  socket.on('fazer-aposta', ({ roomId, aposta }) => {
    const sala = salas.get(roomId);
    if (!sala) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (!jogador) return;

    sala.estado.apostas[jogador.nome] = aposta;
    
    // Notificar todos na sala
    io.to(roomId).emit('aposta-feita', {
      jogadorId: socket.id,
      jogadorNome: jogador.nome,
      aposta: aposta
    });

    // Verificar se todos fizeram aposta
    const todosApostaram = sala.jogadores.every(j => sala.estado.apostas[j.nome] !== null && sala.estado.apostas[j.nome] !== undefined);
    
    if (todosApostaram) {
      // Todos apostaram, iniciar jogo
      sala.estado.faseAposta = false;
      sala.estado.jogando = true;
    } else {
      // Avançar turno para próximo jogador
      const indexAtual = sala.jogadores.findIndex(j => j.id === socket.id);
      sala.estado.turnoAposta = (indexAtual + 1) % sala.jogadores.length;
    }

    io.to(roomId).emit('estado-atualizado', { sala: getSalaInfo(roomId) });
  });

  // Atualizar estado do jogo
  socket.on('atualizar-estado', ({ roomId, estado }) => {
    const sala = salas.get(roomId);
    if (!sala || sala.host !== socket.id) return;

    sala.estado = { ...sala.estado, ...estado };
    socket.to(roomId).emit('estado-atualizado', { sala: getSalaInfo(roomId) });
  });

  // Atualizar mão do jogador
  socket.on('atualizar-mao', ({ roomId, mao }) => {
    const sala = salas.get(roomId);
    if (!sala) return;

    const jogador = sala.jogadores.find(j => j.id === socket.id);
    if (jogador) {
      jogador.mao = mao;
    }
  });

  // Sair da sala
  socket.on('sair-sala', ({ roomId }) => {
    socket.leave(roomId);
    const sala = salas.get(roomId);
    if (sala) {
      sala.jogadores = sala.jogadores.filter(j => j.id !== socket.id);
      
      // Se o host sair, transferir host para próximo jogador
      if (sala.host === socket.id && sala.jogadores.length > 0) {
        sala.host = sala.jogadores[0].id;
        io.to(sala.host).emit('tornou-host', {});
      }

      // Se sala ficar vazia, remover
      if (sala.jogadores.length === 0) {
        salas.delete(roomId);
      } else {
        socket.to(roomId).emit('jogador-saiu', {
          jogadorId: socket.id,
          sala: getSalaInfo(roomId)
        });
      }
    }
    console.log(`${socket.id} saiu da sala ${roomId}`);
  });

  // Desconectar
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    
    // Remover jogador de todas as salas
    salas.forEach((sala, roomId) => {
      const index = sala.jogadores.findIndex(j => j.id === socket.id);
      if (index !== -1) {
        sala.jogadores.splice(index, 1);
        
        // Se o host desconectou, transferir host
        if (sala.host === socket.id && sala.jogadores.length > 0) {
          sala.host = sala.jogadores[0].id;
          io.to(sala.host).emit('tornou-host', {});
        }

        // Se sala ficar vazia, remover
        if (sala.jogadores.length === 0) {
          salas.delete(roomId);
        } else {
          io.to(roomId).emit('jogador-saiu', {
            jogadorId: socket.id,
            sala: getSalaInfo(roomId)
          });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket rodando na porta ${PORT}`);
});
