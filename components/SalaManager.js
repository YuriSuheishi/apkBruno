import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import io from 'socket.io-client';

const SERVER_URL = __DEV__ 
  ? 'http://localhost:3001' 
  : 'https://seu-servidor.com'; // Substitua pela URL do seu servidor em produção

export default function SalaManager({ onEntrarSala, onCriarSala }) {
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [nomeJogador, setNomeJogador] = useState('');
  const [salasDisponiveis, setSalasDisponiveis] = useState([]);
  const [carregandoSalas, setCarregandoSalas] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Conectado ao servidor');
      setConectado(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Desconectado do servidor');
      setConectado(false);
    });

    newSocket.on('erro', ({ mensagem }) => {
      Alert.alert('Erro', mensagem);
    });

    newSocket.on('salas-disponiveis', (salas) => {
      setSalasDisponiveis(salas);
      setCarregandoSalas(false);
    });

    newSocket.on('sala-criada', ({ roomId, jogador, sala }) => {
      onCriarSala({ socket: newSocket, roomId, jogador, sala });
    });

    newSocket.on('entrou-sala', ({ jogador, sala }) => {
      onEntrarSala({ socket: newSocket, jogador, sala });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const criarSala = () => {
    if (!nomeJogador.trim()) {
      Alert.alert('Atenção', 'Digite seu nome');
      return;
    }
    if (!conectado) {
      Alert.alert('Erro', 'Não conectado ao servidor');
      return;
    }
    socket.emit('criar-sala', { nome: nomeJogador.trim() });
  };

  const entrarSalaPorId = () => {
    if (!nomeJogador.trim()) {
      Alert.alert('Atenção', 'Digite seu nome');
      return;
    }
    if (!roomIdInput.trim()) {
      Alert.alert('Atenção', 'Digite o ID da sala');
      return;
    }
    if (!conectado) {
      Alert.alert('Erro', 'Não conectado ao servidor');
      return;
    }
    socket.emit('entrar-sala', { roomId: roomIdInput.trim().toUpperCase(), nome: nomeJogador.trim() });
  };

  const listarSalas = () => {
    if (!conectado) {
      Alert.alert('Erro', 'Não conectado ao servidor');
      return;
    }
    setCarregandoSalas(true);
    socket.emit('listar-salas');
  };

  const entrarSala = (roomId) => {
    if (!nomeJogador.trim()) {
      Alert.alert('Atenção', 'Digite seu nome');
      return;
    }
    socket.emit('entrar-sala', { roomId, nome: nomeJogador.trim() });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fodinha Multiplayer</Text>

      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, conectado && styles.statusDotConectado]} />
        <Text style={styles.statusText}>
          {conectado ? 'Conectado' : 'Desconectado'}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Seu Nome:</Text>
        <TextInput
          style={styles.input}
          value={nomeJogador}
          onChangeText={setNomeJogador}
          placeholder="Digite seu nome"
          maxLength={20}
        />
      </View>

      <TouchableOpacity 
        style={[styles.botao, styles.botaoCriar]} 
        onPress={criarSala}
        disabled={!conectado}
      >
        <Text style={styles.botaoText}>Criar Sala</Text>
      </TouchableOpacity>

      <View style={styles.separador}>
        <View style={styles.linha} />
        <Text style={styles.separadorText}>OU</Text>
        <View style={styles.linha} />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>ID da Sala:</Text>
        <TextInput
          style={styles.input}
          value={roomIdInput}
          onChangeText={setRoomIdInput}
          placeholder="Digite o ID da sala"
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity 
          style={[styles.botao, styles.botaoEntrar]} 
          onPress={entrarSalaPorId}
          disabled={!conectado}
        >
          <Text style={styles.botaoText}>Entrar na Sala</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.separador}>
        <View style={styles.linha} />
        <Text style={styles.separadorText}>OU</Text>
        <View style={styles.linha} />
      </View>

      <TouchableOpacity 
        style={[styles.botao, styles.botaoListar]} 
        onPress={listarSalas}
        disabled={!conectado || carregandoSalas}
      >
        <Text style={styles.botaoText}>
          {carregandoSalas ? 'Carregando...' : 'Listar Salas Disponíveis'}
        </Text>
      </TouchableOpacity>

      {carregandoSalas && (
        <ActivityIndicator size="small" color="#007bff" style={styles.loader} />
      )}

      {salasDisponiveis.length > 0 && (
        <View style={styles.salasContainer}>
          <Text style={styles.salasTitulo}>Salas Disponíveis:</Text>
          {salasDisponiveis.map((sala) => (
            <TouchableOpacity
              key={sala.id}
              style={styles.salaItem}
              onPress={() => entrarSala(sala.id)}
            >
              <Text style={styles.salaId}>{sala.id}</Text>
              <Text style={styles.salaInfo}>
                {sala.jogadores}/{sala.maxJogadores} jogadores
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
    marginRight: 8
  },
  statusDotConectado: {
    backgroundColor: '#28a745'
  },
  statusText: {
    fontSize: 14,
    color: '#666'
  },
  inputContainer: {
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
    marginBottom: 10
  },
  botao: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10
  },
  botaoCriar: {
    backgroundColor: '#28a745'
  },
  botaoEntrar: {
    backgroundColor: '#007bff'
  },
  botaoListar: {
    backgroundColor: '#17a2b8'
  },
  botaoText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20
  },
  linha: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd'
  },
  separadorText: {
    marginHorizontal: 10,
    color: '#666',
    fontWeight: 'bold'
  },
  loader: {
    marginVertical: 10
  },
  salasContainer: {
    marginTop: 20
  },
  salasTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  salaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10,
    backgroundColor: '#f8f9fa'
  },
  salaId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff'
  },
  salaInfo: {
    fontSize: 14,
    color: '#666'
  }
});
