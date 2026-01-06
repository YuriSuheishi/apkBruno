import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MesaVisual({ jogadores, jogadorAtual, turnoAposta, modo }) {
  if (jogadores.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mesa</Text>
      <View style={styles.mesaContainer}>
        {/* Topo da mesa */}
        {jogadores.length > 2 && (
          <View style={styles.linhaHorizontal}>
            {jogadores.slice(1, Math.ceil(jogadores.length / 2) + 1).map((jogador, idx) => {
              const index = idx + 1;
              const isTurno = turnoAposta === index;
              const isAtual = modo === 'multiplayer' 
                ? (jogador.id === jogadorAtual?.id)
                : (index === 0 && modo === 'single');
              return (
                <View key={jogador.id || jogador.nome} style={styles.posicaoMesa}>
                  <View style={[
                    styles.jogadorCarta,
                    isAtual && styles.jogadorCartaAtual,
                    isTurno && styles.jogadorCartaTurno
                  ]}>
                    <Text style={styles.jogadorNome} numberOfLines={1}>
                      {jogador.nome}
                    </Text>
                    {isTurno && <View style={styles.indicadorTurno} />}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Meio: jogador atual (sempre na posição de baixo) */}
        <View style={styles.linhaHorizontal}>
          <View style={styles.posicaoMesa}>
            <View style={[
              styles.jogadorCarta,
              styles.jogadorCartaAtual,
              turnoAposta === 0 && styles.jogadorCartaTurno
            ]}>
              <Text style={styles.jogadorNome} numberOfLines={1}>
                {jogadores[0]?.nome || 'Você'}
              </Text>
              {turnoAposta === 0 && <View style={styles.indicadorTurno} />}
            </View>
          </View>
          {jogadores.length > 3 && jogadores.length <= 4 && (
            <View style={styles.posicaoMesa}>
              <View style={[
                styles.jogadorCarta,
                modo === 'multiplayer' && jogadores[3]?.id === jogadorAtual?.id && styles.jogadorCartaAtual,
                turnoAposta === 3 && styles.jogadorCartaTurno
              ]}>
                <Text style={styles.jogadorNome} numberOfLines={1}>
                  {jogadores[3]?.nome || ''}
                </Text>
                {turnoAposta === 3 && <View style={styles.indicadorTurno} />}
              </View>
            </View>
          )}
        </View>

        {/* Embaixo (se houver mais jogadores) */}
        {jogadores.length === 4 && (
          <View style={styles.linhaHorizontal}>
            <View style={styles.posicaoMesa}>
              <View style={[
                styles.jogadorCarta,
                modo === 'multiplayer' && jogadores[2]?.id === jogadorAtual?.id && styles.jogadorCartaAtual,
                turnoAposta === 2 && styles.jogadorCartaTurno
              ]}>
                <Text style={styles.jogadorNome} numberOfLines={1}>
                  {jogadores[2]?.nome || ''}
                </Text>
                {turnoAposta === 2 && <View style={styles.indicadorTurno} />}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 15
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  mesaContainer: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center'
  },
  linhaHorizontal: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 5
  },
  posicaoMesa: {
    marginHorizontal: 8
  },
  jogadorCarta: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  jogadorCartaAtual: {
    borderColor: '#007bff',
    borderWidth: 3,
    backgroundColor: '#e7f3ff'
  },
  jogadorCartaTurno: {
    borderColor: '#28a745',
    borderWidth: 3,
    backgroundColor: '#d4edda',
    shadowColor: '#28a745',
    shadowOpacity: 0.5,
    elevation: 5
  },
  jogadorNome: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  indicadorTurno: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#28a745',
    borderRadius: 8,
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: '#fff'
  }
});