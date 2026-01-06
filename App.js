import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Image, ActivityIndicator, TextInput, Modal } from 'react-native';
import SalaManager from './components/SalaManager';
import MesaVisual from './components/MesaVisual';

const VALORES = ["4","5","6","7","Q","J","K","A","2","3"]; // Ordem: 4 (mais fraco) até 3 (mais forte)
const NAIPES = ["♣","♥","♠","♦"];
const MAX_LIVES = 3;
const API_BASE_URL = 'https://deckofcardsapi.com/api/deck';

// Mapeamento entre códigos da API e formato interno
const API_SUIT_MAP = {
  'S': '♠',  // Spades
  'D': '♦',  // Diamonds
  'C': '♣',  // Clubs
  'H': '♥'   // Hearts
};

const API_VALUE_MAP = {
  'ACE': 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  'JACK': 'J',
  'QUEEN': 'Q',
  'KING': 'K',
  // Fallback para formato abreviado (caso a API mude)
  'A': 'A',
  'J': 'J',
  'Q': 'Q',
  'K': 'K'
};

// Gerar códigos de cartas para a API (sem 8, 9, 10)
function gerarCodigosCartas() {
  const valores = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
  const naipes = ['S', 'D', 'C', 'H'];
  const cartas = [];
  valores.forEach(v => {
    naipes.forEach(n => {
      cartas.push(v + n);
    });
  });
  return cartas.join(',');
}

// Converter carta da API para formato interno
function apiParaInterno(cartaApi) {
  const valor = API_VALUE_MAP[cartaApi.value] || cartaApi.value;
  const naipe = API_SUIT_MAP[cartaApi.code[1]] || cartaApi.code[1];
  return valor + naipe;
}

// Criar e embaralhar deck na API
async function criarDeckEmbaralhado() {
  try {
    const codigos = gerarCodigosCartas();
    const response = await fetch(`${API_BASE_URL}/new/shuffle/?cards=${codigos}`);
    const data = await response.json();
    if (data.success) {
      return data.deck_id;
    }
    throw new Error('Erro ao criar deck');
  } catch (error) {
    console.error('Erro ao criar deck:', error);
    throw error;
  }
}

// Embaralhar deck existente
async function embaralharDeck(deckId) {
  try {
    const response = await fetch(`${API_BASE_URL}/${deckId}/shuffle/`);
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Erro ao embaralhar deck:', error);
    return false;
  }
}

// Desenhar cartas da API
async function desenharCartas(deckId, count) {
  try {
    const response = await fetch(`${API_BASE_URL}/${deckId}/draw/?count=${count}`);
    const data = await response.json();
    if (data.success) {
      return {
        cartas: data.cards.map(c => ({
          codigo: apiParaInterno(c),
          imagem: c.image,
          valor: c.value,
          naipe: c.suit
        })),
        remaining: data.remaining
      };
    }
    throw new Error('Erro ao desenhar cartas');
  } catch (error) {
    console.error('Erro ao desenhar cartas:', error);
    throw error;
  }
}

function rankOf(card) { 
  const codigo = typeof card === 'string' ? card : card.codigo;
  return codigo.slice(0, -1); 
}

function suitOf(card) { 
  const codigo = typeof card === 'string' ? card : card.codigo;
  return codigo.slice(-1); 
}

function computeManilha(viraRank) { 
  return VALORES[(VALORES.indexOf(viraRank) + 1) % VALORES.length]; 
}

function valorForca(card, manilhaRank) {
  const r = rankOf(card);
  const s = suitOf(card);
  if (r === manilhaRank) { 
    const p = {"♣": 3, "♥": 2, "♠": 1, "♦": 0}; 
    return 100 + p[s]; 
  }
  return VALORES.indexOf(r);
}

// Bot simples - retorna aposta aleatória (0 a número de cartas)
function apostaBot(mao) {
  const n = mao.length;
  return Math.floor(Math.random() * (n + 1)); // 0 a n (inclusive)
}

function jogarBot(mao, manilha, aposta, feitas) {
  let precisa = feitas < aposta;
  let ordenadas = [...mao].sort((a, b) => valorForca(a, manilha) - valorForca(b, manilha));
  let carta = precisa ? ordenadas[ordenadas.length - 1] : ordenadas[0];
  // Retorna a carta escolhida sem modificar o array original
  return carta;
}

export default function App() {
  // Modo de jogo: 'menu', 'single', 'multiplayer'
  const [modo, setModo] = useState('menu');
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [jogadorAtual, setJogadorAtual] = useState(null);
  const [isHost, setIsHost] = useState(false);
  
  // Estados do jogo
  const [deckId, setDeckId] = useState(null);
  const [remaining, setRemaining] = useState(40);
  const [loading, setLoading] = useState(false);
  const [jogadores, setJogadores] = useState([]);
  const [vira, setVira] = useState(null);
  const [viraImagem, setViraImagem] = useState(null);
  const [manilha, setManilha] = useState(null);
  const [roundCards, setRoundCards] = useState(1);
  const [apostas, setApostas] = useState({});
  const [feitas, setFeitas] = useState({});
  const [jogando, setJogando] = useState(false);
  const [mostrarApostaModal, setMostrarApostaModal] = useState(false);
  const [apostaPendente, setApostaPendente] = useState(false);
  const [faseAposta, setFaseAposta] = useState(false); // true quando está na fase de apostas
  const [turnoAposta, setTurnoAposta] = useState(0); // índice do jogador que deve apostar
  const [turnoJogada, setTurnoJogada] = useState(0); // índice do jogador que deve jogar
  const [jogadorInicial, setJogadorInicial] = useState(0); // índice do jogador que inicia (button/dealer)
  const [cartasNaMesa, setCartasNaMesa] = useState([]); // array de {jogador: nome, carta: carta}
  const [vencedorRodada, setVencedorRodada] = useState(null); // nome do jogador que ganhou a rodada
  const [mostrarVencedor, setMostrarVencedor] = useState(false); // controla exibição do vencedor
  
  // Refs para acessar valores atuais do estado sem causar re-renders
  const jogadoresRef = useRef([]);
  const jogadorInicialRef = useRef(0);
  
  // Atualizar refs quando o estado muda
  useEffect(() => {
    jogadoresRef.current = jogadores;
  }, [jogadores]);
  
  useEffect(() => {
    jogadorInicialRef.current = jogadorInicial;
  }, [jogadorInicial]);

  // Single player: inicializar deck
  useEffect(() => {
    if (modo === 'single') {
      async function initDeck() {
        setLoading(true);
        try {
          const id = await criarDeckEmbaralhado();
          setDeckId(id);
          setRemaining(40);
          const novosJogadores = [
            { nome: "Você", tipo: "humano", vidas: MAX_LIVES, mao: [] },
            { nome: "Bot 1", tipo: "bot", dificuldade: "médio", vidas: MAX_LIVES, mao: [] },
            { nome: "Bot 2", tipo: "bot", dificuldade: "médio", vidas: MAX_LIVES, mao: [] }
          ];
          setJogadores(novosJogadores);
          jogadoresRef.current = novosJogadores;
          jogadorInicialRef.current = 0;
        } catch (error) {
          Alert.alert('Erro', 'Não foi possível criar o deck');
        } finally {
          setLoading(false);
        }
      }
      initDeck();
    }
  }, [modo]);

  // Multiplayer: configurar listeners do socket
  useEffect(() => {
    if (socket && modo === 'multiplayer') {
      socket.on('jogo-iniciado', ({ sala }) => {
        // Jogo iniciado após todos fazerem apostas
        setJogando(true);
        setJogadores(sala.jogadores);
      });

      socket.on('jogador-entrou', ({ sala }) => {
        setJogadores(sala.jogadores);
      });

      socket.on('jogador-saiu', ({ sala }) => {
        setJogadores(sala.jogadores);
      });

      socket.on('carta-jogada', ({ jogadorId, jogadorNome, carta }) => {
        if (jogadorId !== socket.id) {
          Alert.alert(`${jogadorNome} jogou`, typeof carta === 'string' ? carta : carta.codigo);
        }
      });

      socket.on('aposta-feita', ({ jogadorNome, aposta }) => {
        setApostas(prev => ({ ...prev, [jogadorNome]: aposta }));
      });

      socket.on('estado-atualizado', ({ sala }) => {
        setFeitas(sala.estado.feitas || {});
        setApostas(sala.estado.apostas || {});
        setJogadores(sala.jogadores);
        if (sala.estado.vira) setVira(sala.estado.vira);
        if (sala.estado.manilha) setManilha(sala.estado.manilha);
        if (sala.estado.faseAposta !== undefined) setFaseAposta(sala.estado.faseAposta);
        if (sala.estado.turnoAposta !== undefined) setTurnoAposta(sala.estado.turnoAposta);
        
        // Se cartas foram distribuidas e é o turno deste jogador, mostrar modal
        const minhaMaoAtual = sala.jogadores.find(j => j.id === socket.id)?.mao || [];
        const meuNome = sala.jogadores.find(j => j.id === socket.id)?.nome;
        const minhaAposta = sala.estado.apostas?.[meuNome];
        const meuIndice = sala.jogadores.findIndex(j => j.id === socket.id);
        
        if (minhaMaoAtual.length > 0 && sala.estado.faseAposta && 
            sala.estado.turnoAposta === meuIndice && 
            minhaAposta === null && !mostrarApostaModal) {
          setMostrarApostaModal(true);
          setApostaPendente(true);
        }
        
        // Se todas apostas foram feitas, iniciar jogo
        if (sala.estado.faseAposta && sala.jogadores.every(j => sala.estado.apostas?.[j.nome] !== null)) {
          setFaseAposta(false);
          setJogando(true);
        }
      });

      socket.on('tornou-host', () => {
        setIsHost(true);
        Alert.alert('Você é o novo host');
      });

      return () => {
        socket.off('jogo-iniciado');
        socket.off('jogador-entrou');
        socket.off('jogador-saiu');
        socket.off('carta-jogada');
        socket.off('aposta-feita');
        socket.off('estado-atualizado');
        socket.off('tornou-host');
      };
    }
  }, [socket, modo]);

  const handleCriarSala = ({ socket: newSocket, roomId: newRoomId, jogador, sala }) => {
    setSocket(newSocket);
    setRoomId(newRoomId);
    setJogadorAtual(jogador);
    setIsHost(true);
    setJogadores(sala.jogadores);
    setModo('multiplayer');
  };

  const handleEntrarSala = ({ socket: newSocket, jogador, sala }) => {
    setSocket(newSocket);
    setJogadorAtual(jogador);
    setIsHost(sala.host === jogador.id);
    setJogadores(sala.jogadores);
    setModo('multiplayer');
  };

  // Distribuir cartas (single player)
  const distribuirSingle = async (numCartas) => {
    if (!deckId) {
      Alert.alert('Aguarde', 'O deck está sendo criado...');
      return;
    }

    setLoading(true);
    try {
      // Usar ref para acessar valores atuais (garante valores mais recentes)
      // Se a ref estiver vazia, usar o estado diretamente como fallback
      const currentJogadores = jogadoresRef.current && jogadoresRef.current.length > 0 
        ? jogadoresRef.current 
        : jogadores;
      const ativosComVida = currentJogadores.filter(j => j.vidas > 0);
      
      if (ativosComVida.length === 0) {
        Alert.alert('Erro', 'Não há jogadores ativos');
        setLoading(false);
        return;
      }
      let currentDeckId = deckId;
      
      if (remaining < numCartas * ativosComVida.length + 1) {
        currentDeckId = await criarDeckEmbaralhado();
        setDeckId(currentDeckId);
        setRemaining(40);
      }

      // Preservar as vidas ao criar novos jogadores
      let ativos = ativosComVida.map(j => ({ ...j, mao: [] }));
      const totalCartas = numCartas * ativos.length + 1;

      const resultado = await desenharCartas(currentDeckId, totalCartas);
      setRemaining(resultado.remaining);

      let index = 0;
      for (let i = 0; i < numCartas; i++) {
        for (let j = 0; j < ativos.length; j++) {
          ativos[j].mao.push(resultado.cartas[index]);
          index++;
        }
      }

      const novaVira = resultado.cartas[index];
      setVira(novaVira.codigo);
      setViraImagem(novaVira.imagem);
      setManilha(computeManilha(rankOf(novaVira)));

      let apostasInit = {}, feitasInit = {};
      ativos.forEach(j => {
        apostasInit[j.nome] = null; // Todos começam sem aposta
        feitasInit[j.nome] = 0;
      });
      setApostas(apostasInit);
      setFeitas(feitasInit);
      setJogadores(ativos);
      jogadoresRef.current = ativos; // Atualizar ref
      
      // Usar ref para acessar jogadorInicial atual
      const currentJogadorInicial = jogadorInicialRef.current;
      const indiceInicial = currentJogadorInicial >= ativos.length ? 0 : currentJogadorInicial;
      
      // Ajustar jogadorInicial se necessário
      if (currentJogadorInicial >= ativos.length) {
        setJogadorInicial(0);
        jogadorInicialRef.current = 0;
      }
      
      // Fase de apostas: cartas já foram distribuídas, agora apostar
      setFaseAposta(true);
      setTurnoAposta(indiceInicial);
      
      // Jogador inicial começa apostando
      const jogadorInicialAtivo = ativos[indiceInicial];
      if (jogadorInicialAtivo && jogadorInicialAtivo.tipo === "bot") {
        // Bot faz aposta aleatória automaticamente
        const apostaBotValor = apostaBot([...jogadorInicialAtivo.mao]);
        apostasInit[jogadorInicialAtivo.nome] = apostaBotValor;
        setApostas(apostasInit);
        
        // Processar próximo turno após um delay
        setTimeout(() => {
          processarProximoTurnoAposta(indiceInicial);
        }, 1000);
      } else {
        // Jogador humano deve apostar
        setMostrarApostaModal(true);
        setApostaPendente(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível distribuir as cartas');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar jogo multiplayer
  const iniciarJogoMultiplayer = async () => {
    if (!socket || !isHost) return;
    
    setLoading(true);
    try {
      // Criar deck e distribuir cartas
      const id = await criarDeckEmbaralhado();
      setDeckId(id);
      
      const numCartas = 1; // Primeira rodada
      const totalCartas = numCartas * jogadores.length + 1;
      
      const resultado = await desenharCartas(id, totalCartas);
      setRemaining(resultado.remaining);

      // Distribuir cartas
      let index = 0;
      const novasMaos = {};
      
      for (let i = 0; i < numCartas; i++) {
        for (let j = 0; j < jogadores.length; j++) {
          if (!novasMaos[jogadores[j].nome]) novasMaos[jogadores[j].nome] = [];
          novasMaos[jogadores[j].nome].push(resultado.cartas[index]);
          index++;
        }
      }

      const novaVira = resultado.cartas[index];
      const manilhaRank = computeManilha(rankOf(novaVira));
      
      // Atualizar mãos dos jogadores no servidor
      jogadores.forEach((jogador, idx) => {
        if (socket.id === jogador.id) {
          // Atualizar mão local
          setJogadores(prev => {
            const novos = [...prev];
            novos[idx] = { ...novos[idx], mao: novasMaos[jogador.nome] };
            return novos;
          });
        }
        socket.emit('atualizar-mao', { roomId, mao: novasMaos[jogador.nome] });
      });

      setVira(novaVira.codigo);
      setViraImagem(novaVira.imagem);
      setManilha(manilhaRank);

      // Inicializar apostas e fase de apostas
      const apostasInit = {};
      jogadores.forEach(j => {
        apostasInit[j.nome] = null; // Todos começam sem aposta
      });
      setApostas(apostasInit);
      setFeitas({});
      setFaseAposta(true);
      setTurnoAposta(0);

      socket.emit('atualizar-estado', {
        roomId,
        estado: {
          vira: novaVira.codigo,
          manilha: manilhaRank,
          jogando: false, // Não inicia ainda, aguardando apostas
          rodada: 1,
          apostas: apostasInit,
          faseAposta: true,
          turnoAposta: 0,
          feitas: {}
        }
      });

      // Host começa apostando
      setMostrarApostaModal(true);
      setApostaPendente(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível iniciar o jogo');
    } finally {
      setLoading(false);
    }
  };

  // Determinar vencedor da "mão" (uma rodada de jogadas)
  const determinarVencedor = (cartas) => {
    if (cartas.length === 0) return null;
    
    let vencedor = cartas[0];
    let maiorForca = valorForca(cartas[0].carta, manilha);
    
    for (let i = 1; i < cartas.length; i++) {
      const forca = valorForca(cartas[i].carta, manilha);
      if (forca > maiorForca) {
        maiorForca = forca;
        vencedor = cartas[i];
      }
    }
    
    return vencedor.jogador;
  };

  // Calcular vidas perdidas ao final da rodada
  const calcularVidasPerdidas = () => {
    // Usar callbacks funcionais para acessar os valores mais recentes
    setFeitas(currentFeitas => {
      setApostas(currentApostas => {
        setJogadores(prev => {
          console.log("=== CALCULAR VIDAS PERDIDAS ===");
          console.log("Feitas atual:", currentFeitas);
          console.log("Apostas atual:", currentApostas);
          console.log("Jogadores antes:", prev.map(j => ({ nome: j.nome, vidas: j.vidas })));
          
          const ativos = prev.filter(j => j.vidas > 0);
          const resultados = {};
          
          ativos.forEach(jogador => {
            const feitasJogador = currentFeitas[jogador.nome] || 0;
            const apostaJogador = currentApostas[jogador.nome] || 0;
        
            // Calcular diferença absoluta (perde 1 vida por unidade de diferença)
            const diferenca = Math.abs(feitasJogador - apostaJogador);
            
            resultados[jogador.nome] = {
              feitas: feitasJogador,
              aposta: apostaJogador,
              vidasPerdidas: diferenca
            };
            
            console.log(`${jogador.nome}: feitas=${feitasJogador}, aposta=${apostaJogador}, diferença=${diferenca}, vidas antes=${jogador.vidas}`);
          });
          
          // Atualizar vidas
          const novosJogadores = prev.map(j => {
            const resultado = resultados[j.nome];
            if (resultado && resultado.vidasPerdidas > 0 && j.vidas > 0) {
              const vidasPerder = Math.min(resultado.vidasPerdidas, j.vidas);
              console.log(`${j.nome}: perdendo ${vidasPerder} vida(s), de ${j.vidas} para ${j.vidas - vidasPerder}`);
              return { ...j, vidas: j.vidas - vidasPerder };
            }
            console.log(`${j.nome}: não perdeu vida (vidasPerdidas=${resultado?.vidasPerdidas || 0}, vidas=${j.vidas})`);
            return j;
          });
          
          console.log("Jogadores depois:", novosJogadores.map(j => ({ nome: j.nome, vidas: j.vidas })));
      
      // Verificar se o jogo acabou ANTES de mostrar o Alert
      const ativosAposRodada = novosJogadores.filter(j => j.vidas > 0);
      const jogadorHumanoPerdeu = novosJogadores.find(j => j.nome === 'Você')?.vidas === 0;
      const jogoAcabou = ativosAposRodada.length <= 1;
      
      // Criar logs detalhados
      console.log("=== RESULTADO DA RODADA ===");
      
      // Mostrar resultado
      let mensagem = "Resultado da Rodada:\n\n";
      ativos.forEach(jogador => {
        const resultado = resultados[jogador.nome];
        if (resultado) {
          // A vida só cai quando feitas ≠ apostadas (diferença > 0)
          if (resultado.vidasPerdidas > 0) {
            // Exemplo: "Você: apostou 2, fez 4 → perdeu 2 vida(s)"
            mensagem += `${jogador.nome}: apostou ${resultado.aposta}, fez ${resultado.feitas} → perdeu ${resultado.vidasPerdidas} vida${resultado.vidasPerdidas !== 1 ? 's' : ''}\n`;
            console.log(`❌ ${jogador.nome}: apostou ${resultado.aposta}, fez ${resultado.feitas} → perdeu ${resultado.vidasPerdidas} vida(s)`);
          } else {
            // Acertou exatamente
            mensagem += `${jogador.nome}: apostou ${resultado.aposta}, fez ${resultado.feitas} → ✅ Acertou!\n`;
            console.log(`✅ ${jogador.nome}: apostou ${resultado.aposta}, fez ${resultado.feitas} → Acertou!`);
          }
        }
      });
      console.log("==========================");
      
      Alert.alert("Fim da Rodada", mensagem, [
        {
          text: "OK",
          onPress: () => {
            if (jogoAcabou || jogadorHumanoPerdeu) {
              // Jogo acabou - mostrar mensagem de vitória/derrota
              setTimeout(() => {
                let titulo = "🏆 Fim de Jogo!";
                let mensagem = "";
                
                if (jogadorHumanoPerdeu) {
                  titulo = "💀 Você Perdeu!";
                  mensagem = "Você ficou sem vidas!\n\n";
                  if (ativosAposRodada.length > 0) {
                    mensagem += `${ativosAposRodada[0].nome} venceu o jogo! 🎉`;
                  } else {
                    mensagem += "Ninguém venceu.";
                  }
                } else if (ativosAposRodada.length === 1) {
                  if (ativosAposRodada[0].nome === 'Você') {
                    titulo = "🏆 Você Venceu!";
                    mensagem = "Parabéns! Você foi o último sobrevivente! 🎉";
                  } else {
                    mensagem = `${ativosAposRodada[0].nome} venceu o jogo! 🎉`;
                  }
                } else {
                  mensagem = "Empate! Ninguém venceu.";
                }
                
                Alert.alert(
                  titulo,
                  mensagem,
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        // Voltar ao menu
                        setModo('menu');
                        setJogadores([]);
                        setJogando(false);
                        setFaseAposta(false);
                        setCartasNaMesa([]);
                        setVencedorRodada(null);
                        setMostrarVencedor(false);
                        setFeitas({});
                        setApostas({});
                        setJogadorInicial(0);
                        jogadorInicialRef.current = 0;
                        setRoundCards(1);
                      }
                    }
                  ]
                );
              }, 500);
            } else {
              // Resetar estado para próxima rodada
              setFeitas({});
              setApostas({});
              setJogando(false);
              setFaseAposta(false);
              setCartasNaMesa([]);
              setVencedorRodada(null);
              setMostrarVencedor(false);
              
              // Rotacionar jogador inicial (button) para próxima rodada
              if (ativosAposRodada.length > 0) {
                // Ajustar jogadorInicial para o range válido se necessário, depois rotacionar
                setJogadorInicial(prev => {
                  // Garantir que o índice esteja no range válido
                  const indiceAjustado = prev >= ativosAposRodada.length ? 0 : prev;
                  // Rotacionar para o próximo
                  const novoIndice = (indiceAjustado + 1) % ativosAposRodada.length;
                  jogadorInicialRef.current = novoIndice; // Atualizar ref
                  return novoIndice;
                });
              }
            }
          }
        }
      ]);
      
          return novosJogadores;
        });
        return currentApostas; // Retornar para não modificar o estado
      });
      return currentFeitas; // Retornar para não modificar o estado
    });
  };

  // Processar próxima jogada (single player)
  const processarProximaJogada = () => {
    setCartasNaMesa(prevCartas => {
      setJogadores(prevJogadores => {
        const ativos = prevJogadores.filter(j => j.vidas > 0);
        
        // Verificar se todos já jogaram
        if (prevCartas.length >= ativos.length) {
          // Todos jogaram, determinar vencedor
          const vencedor = determinarVencedor(prevCartas);
          setVencedorRodada(vencedor);
          setMostrarVencedor(true);
          
          // Incrementar feitas do vencedor
          setFeitas(prevFeitas => ({
            ...prevFeitas,
            [vencedor]: (prevFeitas[vencedor] || 0) + 1
          }));
          
          // Após 2s, limpar mesa e verificar se acabaram as cartas
          setTimeout(() => {
            setJogadores(currentJogadores => {
              const ativosAtual = currentJogadores.filter(j => j.vidas > 0);
              setMostrarVencedor(false);
              setVencedorRodada(null);
              setCartasNaMesa([]);
              
              // Verificar se ainda há cartas para jogar
              const temCartas = ativosAtual.some(j => j.mao.length > 0);
              if (temCartas) {
                // Nova "mão" (mais uma rodada de jogadas) - mantém mesmo jogador inicial
                // Usar ref para acessar o valor atual de jogadorInicial
                const currentJogadorInicial = jogadorInicialRef.current;
                setTurnoJogada(currentJogadorInicial);
                setTimeout(() => processarProximaJogada(), 100);
              } else {
                // Todas as cartas foram jogadas, rodada terminou - calcular vidas
                calcularVidasPerdidas();
              }
              return currentJogadores;
            });
          }, 2000);
          
          return prevJogadores;
        }
        
        // Próximo jogador (ordem circular começando do jogadorInicial)
        // Usar ref para acessar o valor atual de jogadorInicial
        const currentJogadorInicial = jogadorInicialRef.current;
        const proximoTurno = (currentJogadorInicial + prevCartas.length) % ativos.length;
        setTurnoJogada(proximoTurno);
        
        const proximoJogador = ativos[proximoTurno];
        
        if (proximoJogador && proximoJogador.tipo === "bot") {
          // Bot joga automaticamente após 2s
          setTimeout(() => {
            setJogadores(prev => {
              const ativosAtualizados = prev.filter(j => j.vidas > 0);
              const jogadorAtualizado = ativosAtualizados.find(j => j.nome === proximoJogador.nome);
              
              if (jogadorAtualizado && jogadorAtualizado.mao.length > 0) {
                // Escolher carta
                const cartaEscolhida = jogarBot([...jogadorAtualizado.mao], manilha, apostas[jogadorAtualizado.nome] || 0, feitas[jogadorAtualizado.nome] || 0);
                
                // Remover carta da mão
                const novosJogadores = prev.map(j => {
                  if (j.nome === proximoJogador.nome) {
                    const novaMao = j.mao.filter(c => {
                      const codigo1 = typeof c === 'string' ? c : c.codigo;
                      const codigo2 = typeof cartaEscolhida === 'string' ? cartaEscolhida : cartaEscolhida.codigo;
                      return codigo1 !== codigo2;
                    });
                    return { ...j, mao: novaMao };
                  }
                  return j;
                });
                
                // Adicionar carta na mesa (atualizar estado primeiro)
                setCartasNaMesa(prevCartasMesa => [...prevCartasMesa, { jogador: proximoJogador.nome, carta: cartaEscolhida }]);
                
                // Após 2s, processar próxima jogada
                setTimeout(() => processarProximaJogada(), 2000);
                
                return novosJogadores;
              }
              return prev;
            });
          }, 2000);
        }
        // Se for jogador humano, aguarda ele clicar na carta
        
        return prevJogadores;
      });
      return prevCartas;
    });
  };

  const jogarCarta = (idx) => {
    if (!jogando || loading || faseAposta) return;

    const ativos = jogadores.filter(j => j.vidas > 0);
    const jogadorAtual = modo === 'multiplayer' 
      ? jogadores.find(j => j.id === socket?.id)
      : ativos[turnoJogada];
    
    if (!jogadorAtual || jogadorAtual.mao.length <= idx) return;
    
    // Verificar se é o turno do jogador
    if (modo === 'single') {
      const indexJogadorAtual = ativos.findIndex(j => j.nome === jogadorAtual.nome);
      if (indexJogadorAtual !== turnoJogada) {
        Alert.alert('Não é sua vez', 'Aguarde seu turno');
        return;
      }
    }

    if (modo === 'multiplayer') {
      if (!socket || !roomId) return;
      const minhaMao = jogadores.find(j => j.id === socket.id)?.mao || [];
      if (!minhaMao[idx]) return;

      socket.emit('jogar-carta', { roomId, cartaIndex: idx });
      
      // Atualizar mão local
      setJogadores(prev => prev.map(j => {
        if (j.id === socket.id) {
          const novaMao = [...j.mao];
          novaMao.splice(idx, 1);
          return { ...j, mao: novaMao };
        }
        return j;
      }));
    } else {
      // Single player
      const carta = jogadorAtual.mao[idx];
      
      // Remover carta da mão
      setJogadores(prev => prev.map(j => {
        if (j.nome === jogadorAtual.nome) {
          const novaMao = [...j.mao];
          novaMao.splice(idx, 1);
          return { ...j, mao: novaMao };
        }
        return j;
      }));
      
      // Adicionar carta na mesa
      setCartasNaMesa(prev => [...prev, { jogador: jogadorAtual.nome, carta }]);
      
      // Após 2s, processar próxima jogada
      setTimeout(() => {
        processarProximaJogada();
      }, 2000);
    }
  };

  const renderMao = (mao, ocultar = false, jogadorId = null) => {
    if (!mao || mao.length === 0) return null;
    
    if (ocultar || (modo === 'multiplayer' && jogadorId !== socket?.id)) {
      return mao.map((c, i) => (
        <View key={i} style={styles.cartaContainer}>
          <Image 
            source={{ uri: 'https://deckofcardsapi.com/static/img/back.png' }}
            style={styles.cartaImagem}
          />
        </View>
      ));
    }
    return mao.map((c, i) => (
      <View key={i} style={styles.cartaContainer}>
        <Image 
          source={{ uri: typeof c === 'string' ? null : c.imagem }}
          style={styles.cartaImagem}
        />
      </View>
    ));
  };

  // Encontrar mão do jogador humano (single player) ou do jogador atual (multiplayer)
  const minhaMao = modo === 'multiplayer' 
    ? (jogadores.find(j => j.id === socket?.id)?.mao || [])
    : (jogadores.find(j => j.nome === 'Você')?.mao || []);

  // Processar próximo turno de aposta (single player)
  const processarProximoTurnoAposta = (turnoAtual) => {
    const currentJogadores = jogadoresRef.current;
    const ativos = currentJogadores.filter(j => j.vidas > 0);
    const proximoTurno = (turnoAtual + 1) % ativos.length;
    const currentJogadorInicial = jogadorInicialRef.current;
    
    if (proximoTurno === currentJogadorInicial) {
      // Todos fizeram aposta (voltou ao jogador inicial), iniciar fase de jogadas
      setFaseAposta(false);
      setJogando(true);
      setTurnoJogada(currentJogadorInicial);
      setCartasNaMesa([]);
      setVencedorRodada(null);
      setMostrarVencedor(false);
      
      // Iniciar primeira jogada
      setTimeout(() => {
        processarProximaJogada();
      }, 500);
      return;
    }

    setTurnoAposta(proximoTurno);
    const proximoJogador = ativos[proximoTurno];
    
    if (proximoJogador.tipo === "bot") {
      // Bot faz aposta aleatória automaticamente
      const apostaBotValor = apostaBot([...proximoJogador.mao]);
      setApostas(prev => ({ ...prev, [proximoJogador.nome]: apostaBotValor }));
      
      // Aguardar um pouco e processar próximo turno
      setTimeout(() => {
        processarProximoTurnoAposta(proximoTurno);
      }, 1000);
    } else {
      // Jogador humano deve apostar
      setMostrarApostaModal(true);
      setApostaPendente(true);
    }
  };

  // Confirmar aposta do jogador
  const confirmarAposta = (apostaSelecionada) => {
    const numCartas = minhaMao.length;
    if (apostaSelecionada < 0 || apostaSelecionada > numCartas) {
      Alert.alert('Aposta inválida', `A aposta deve estar entre 0 e ${numCartas}`);
      return;
    }

    const nomeJogador = modo === 'multiplayer' 
      ? (jogadores.find(j => j.id === socket?.id)?.nome || 'Você')
      : (() => {
          const ativos = jogadores.filter(j => j.vidas > 0);
          return ativos[turnoAposta]?.nome || 'Você';
        })();

    setApostas(prev => ({ ...prev, [nomeJogador]: apostaSelecionada }));
    setMostrarApostaModal(false);
    setApostaPendente(false);

    // Enviar aposta para o servidor (multiplayer)
    if (modo === 'multiplayer' && socket && roomId) {
      socket.emit('fazer-aposta', { roomId, aposta: apostaSelecionada });
      // No multiplayer, o servidor controla os turnos
    } else {
      // Single player: avançar turno
      processarProximoTurnoAposta(turnoAposta);
    }
  };

  // Menu principal
  if (modo === 'menu') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Fodinha RN</Text>
        <TouchableOpacity 
          style={[styles.botao, styles.botaoSingle]} 
          onPress={() => setModo('single')}
        >
          <Text style={styles.botaoText}>Jogar Solo (com Bots)</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.botao, styles.botaoMulti]} 
          onPress={() => setModo('lobby')}
        >
          <Text style={styles.botaoText}>Multiplayer Online</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Lobby multiplayer
  if (modo === 'lobby') {
    return <SalaManager onCriarSala={handleCriarSala} onEntrarSala={handleEntrarSala} />;
  }

  // Tela de jogo
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fodinha {modo === 'multiplayer' ? 'Multiplayer' : 'RN'}</Text>
        {modo === 'multiplayer' && roomId && (
          <View style={styles.roomInfo}>
            <Text style={styles.roomId}>Sala: {roomId}</Text>
            {isHost && <Text style={styles.hostBadge}>HOST</Text>}
          </View>
        )}
        {modo === 'multiplayer' && (
          <TouchableOpacity 
            style={styles.botaoVoltar}
            onPress={() => {
              if (socket && roomId) {
                socket.emit('sair-sala', { roomId });
                socket.close();
              }
              setModo('menu');
              setSocket(null);
              setRoomId(null);
            }}
          >
            <Text style={styles.botaoText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Mesa Visual */}
      {jogadores.length > 0 && (faseAposta || jogando) && (
        <MesaVisual 
          jogadores={jogadores} 
          jogadorAtual={jogadorAtual} 
          turnoAposta={turnoAposta}
          modo={modo}
        />
      )}

      <View style={styles.viraContainer}>
        <Text style={styles.viraLabel}>Vira: {vira} → Manilha: {manilha}</Text>
        {viraImagem && (
          <Image source={{ uri: viraImagem }} style={styles.viraImagem} />
        )}
      </View>

      {faseAposta && (
        <Text style={{ marginTop: 10, fontWeight: 'bold', color: '#28a745', textAlign: 'center' }}>
          Fase de Apostas - Rodada {roundCards} ({roundCards} carta{roundCards !== 1 ? 's' : ''})
        </Text>
      )}

      <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Placar de vidas:</Text>
      {jogadores.map(j => (
        <Text key={j.id || j.nome}>
          {j.nome}: {j.vidas || MAX_LIVES} vidas | Feitas: {feitas[j.nome] || 0} | Aposta: {apostas[j.nome] !== null && apostas[j.nome] !== undefined ? apostas[j.nome] : '?'}
        </Text>
      ))}

      {!jogando && !faseAposta && modo === 'single' && (
        <TouchableOpacity 
          style={[styles.botao, styles.botaoIniciar]} 
          onPress={() => {
            setRoundCards(1); // Primeira rodada começa com 1 carta
            distribuirSingle(1);
          }}
          disabled={loading || !deckId}
        >
          <Text style={styles.botaoText}>
            {loading ? 'Iniciando...' : 'Iniciar Jogo'}
          </Text>
        </TouchableOpacity>
      )}

      {faseAposta && modo === 'single' && (() => {
        const ativos = jogadores.filter(j => j.vidas > 0);
        const jogadorNoTurno = ativos[turnoAposta];
        return (
          <Text style={{ marginTop: 10, textAlign: 'center', color: '#666' }}>
            {jogadorNoTurno?.tipo === "bot" 
              ? `${jogadorNoTurno?.nome} está pensando...`
              : `É sua vez de apostar!`
            }
          </Text>
        );
      })()}

      {!jogando && modo === 'multiplayer' && isHost && (
        <TouchableOpacity 
          style={[styles.botao, styles.botaoIniciar]} 
          onPress={iniciarJogoMultiplayer}
          disabled={loading || jogadores.length < 2}
        >
          <Text style={styles.botaoText}>
            {loading ? 'Iniciando...' : 'Iniciar Jogo'}
          </Text>
        </TouchableOpacity>
      )}

      {(faseAposta || jogando) && (
        <>
          <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Sua mão:</Text>
          <View style={styles.mao}>
            {modo === 'multiplayer' 
              ? renderMao(minhaMao, false, socket?.id)
              : renderMao(minhaMao, false)
            }
          </View>

          {/* Cartas na Mesa */}
          {cartasNaMesa.length > 0 && (
            <View style={{ marginTop: 15, marginBottom: 10 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Cartas na Mesa:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {cartasNaMesa.map((item, index) => (
                  <View key={index} style={{ margin: 5, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, marginBottom: 2 }}>{item.jogador}</Text>
                    <Image 
                      source={{ uri: typeof item.carta === 'string' ? null : item.carta.imagem }} 
                      style={[styles.cartaImagem, { width: 60, height: 84 }]} 
                    />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Vencedor da Rodada */}
          {mostrarVencedor && vencedorRodada && (
            <View style={{ marginVertical: 15, padding: 15, backgroundColor: '#d4edda', borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#155724' }}>
                {vencedorRodada} ganhou a rodada!
              </Text>
            </View>
          )}

          {/* Indicador de Turno */}
          {jogando && !faseAposta && (() => {
            const ativos = jogadores.filter(j => j.vidas > 0);
            const jogadorNoTurno = ativos[turnoJogada];
            const meuIndice = ativos.findIndex(j => j.nome === 'Você');
            const eMinhaVez = turnoJogada === meuIndice;
            
            return (
              <Text style={{ marginTop: 10, textAlign: 'center', color: '#666' }}>
                {modo === 'single' && jogadorNoTurno?.tipo === "bot"
                  ? `${jogadorNoTurno?.nome} está jogando...`
                  : modo === 'single' && eMinhaVez
                  ? 'É sua vez de jogar!'
                  : 'Aguarde seu turno'
                }
              </Text>
            );
          })()}

          {jogando && !faseAposta && (
            <View style={styles.botaoContainer}>
              {minhaMao.map((c, i) => {
                const ativos = jogadores.filter(j => j.vidas > 0);
                const meuIndice = modo === 'single' 
                  ? ativos.findIndex(j => j.nome === 'Você')
                  : ativos.findIndex(j => j.id === socket?.id);
                const podeJogar = modo === 'single' ? (turnoJogada === meuIndice) : true;
                
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.botaoCarta, !podeJogar && { opacity: 0.5 }]} 
                    onPress={() => jogarCarta(i)}
                    disabled={loading || !podeJogar}
                  >
                    {typeof c === 'string' ? (
                      <Text style={styles.botaoText}>{c}</Text>
                    ) : (
                      <Image source={{ uri: c.imagem }} style={styles.botaoCartaImagem} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {jogando && modo === 'single' && (
            <TouchableOpacity 
              style={[styles.botao, loading && styles.botaoDisabled]} 
              onPress={() => {
                // Incrementar número de cartas (máximo 7)
                const proximasCartas = Math.min(roundCards + 1, 7);
                setRoundCards(proximasCartas);
                distribuirSingle(proximasCartas);
              }}
              disabled={loading}
            >
              <Text style={styles.botaoText}>
                {loading ? 'Carregando...' : `Nova Rodada (${Math.min(roundCards + 1, 7)} carta${Math.min(roundCards + 1, 7) !== 1 ? 's' : ''})`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {deckId && modo === 'single' && (
        <Text style={styles.infoText}>Cartas restantes: {remaining}</Text>
      )}

      {/* Modal de Seleção de Aposta */}
      <Modal
        visible={mostrarApostaModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Faça sua aposta</Text>
            <Text style={styles.modalSubtitle}>
              Quantas rodadas você acha que vai ganhar?
            </Text>
            <Text style={styles.modalInfo}>
              Você tem {minhaMao.length} carta{minhaMao.length !== 1 ? 's' : ''} na mão
            </Text>
            
            <View style={styles.apostaButtons}>
              {Array.from({ length: minhaMao.length + 1 }, (_, i) => i).map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.apostaButton}
                  onPress={() => confirmarAposta(num)}
                >
                  <Text style={styles.apostaButtonText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  roomInfo: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  roomId: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  hostBadge: { backgroundColor: '#ffc107', color: '#000', padding: 4, borderRadius: 4, fontSize: 12, fontWeight: 'bold' },
  botaoVoltar: { backgroundColor: '#dc3545', padding: 10, borderRadius: 5, marginTop: 10, alignItems: 'center' },
  loadingText: { marginTop: 10, textAlign: 'center' },
  viraContainer: { alignItems: 'center', marginBottom: 10 },
  viraLabel: { marginBottom: 5 },
  viraImagem: { width: 80, height: 112, borderRadius: 5 },
  mao: { flexDirection: 'row', marginVertical: 10, flexWrap: 'wrap', justifyContent: 'center' },
  cartaContainer: { margin: 5 },
  cartaImagem: { width: 60, height: 84, borderRadius: 5 },
  botaoContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' },
  botaoCarta: { 
    padding: 5, 
    borderWidth: 2, 
    borderRadius: 5, 
    margin: 5, 
    backgroundColor: '#fff',
    borderColor: '#007bff'
  },
  botaoCartaImagem: { width: 70, height: 98, borderRadius: 5 },
  botao: { backgroundColor: '#007bff', padding: 15, borderRadius: 5, marginTop: 20, alignItems: 'center' },
  botaoSingle: { backgroundColor: '#28a745', marginTop: 40 },
  botaoMulti: { backgroundColor: '#17a2b8' },
  botaoIniciar: { backgroundColor: '#28a745' },
  botaoDisabled: { backgroundColor: '#ccc' },
  botaoText: { color: '#fff', fontWeight: 'bold' },
  infoText: { textAlign: 'center', marginTop: 10, color: '#666' }
});