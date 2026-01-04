import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView } from 'react-native';

const VALORES = ["4","5","6","7","8","9","10","Q","J","K","A","2","3"];
const NAIPES = ["♣","♥","♠","♦"];
const MAX_LIVES = 3;

function criarBaralho(){
  let baralho = [];
  VALORES.forEach(v=>NAIPES.forEach(n=>baralho.push(v+n)));
  return baralho;
}

function embaralhar(baralho){
  for(let i=baralho.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [baralho[i],baralho[j]]=[baralho[j],baralho[i]];
  }
  return baralho;
}

function rankOf(card){ return card.slice(0,-1); }
function suitOf(card){ return card.slice(-1); }
function computeManilha(viraRank){ return VALORES[(VALORES.indexOf(viraRank)+1)%VALORES.length]; }
function valorForca(card, manilhaRank){
  const r=rankOf(card), s=suitOf(card);
  if(r===manilhaRank){ const p={"♣":3,"♥":2,"♠":1,"♦":0}; return 100+p[s]; }
  return VALORES.indexOf(r);
}

// Bot simples
function apostaBot(mao, manilha, dificuldade){
  let fortes = mao.filter(c=>["A","2","3",manilha].includes(rankOf(c))).length;
  const n=mao.length;
  if(dificuldade==="fácil") return Math.floor(Math.random()*(n+1));
  if(dificuldade==="médio") return Math.min(n, Math.max(0,fortes+Math.floor(Math.random()*3)-1));
  if(dificuldade==="difícil") return Math.min(n, Math.max(0,fortes));
  return Math.floor(Math.random()*(n+1));
}

function jogarBot(mao, manilha, aposta, feitas){
  let precisa = feitas<aposta;
  let ordenadas = [...mao].sort((a,b)=>valorForca(a,manilha)-valorForca(b,manilha));
  let carta = precisa?ordenadas[ordenadas.length-1]:ordenadas[0];
  mao.splice(mao.indexOf(carta),1);
  return carta;
}

export default function App(){
  const [baralho,setBaralho]=useState(embaralhar(criarBaralho()));
  const [jogadores,setJogadores]=useState([
    {nome:"Você", tipo:"humano", vidas:MAX_LIVES, mao:[]},
    {nome:"Bot 1", tipo:"bot", dificuldade:"médio", vidas:MAX_LIVES, mao:[]},
    {nome:"Bot 2", tipo:"bot", dificuldade:"médio", vidas:MAX_LIVES, mao:[]}
  ]);
  const [vira,setVira]=useState(null);
  const [manilha,setManilha]=useState(null);
  const [roundCards,setRoundCards]=useState(1);
  const [apostas,setApostas]=useState({});
  const [feitas,setFeitas]=useState({});
  const [jogando,setJogando]=useState(false);
  const [ordem,setOrdem]=useState(0);

  // Distribuir cartas
  const distribuir=(numCartas)=>{
    let novoBaralho=[...baralho];
    let ativos=jogadores.filter(j=>j.vidas>0).map(j=>({...j,mao:[]}));
    for(let i=0;i<numCartas;i++){
      for(let j=0;j<ativos.length;j++){
        if(novoBaralho.length===0) novoBaralho=embaralhar(criarBaralho());
        ativos[j].mao.push(novoBaralho.pop());
      }
    }
    if(novoBaralho.length===0) novoBaralho=embaralhar(criarBaralho());
    const novaVira=novoBaralho.pop();
    setVira(novaVira);
    setManilha(computeManilha(rankOf(novaVira)));
    setBaralho(novoBaralho);

    let apostasInit={}, feitasInit={};
    ativos.forEach(j=>{
      apostasInit[j.nome]=j.tipo==="bot"?apostaBot([...j.mao], computeManilha(rankOf(novaVira)), j.dificuldade):0;
      feitasInit[j.nome]=0;
    });
    setApostas(apostasInit); setFeitas(feitasInit);
    setJogadores(ativos);
    setOrdem(0);
    setJogando(true);
  };

  useEffect(()=>{ distribuir(1); },[]);

  const renderMao=(mao,ocultar=false)=>mao.map((c,i)=><Text key={i} style={styles.carta}>{ocultar?"[?]":c}</Text>);

  const jogarCarta=(idx)=>{
    if(!jogando) return;
    let novos=[...jogadores];
    let mao=[...novos[0].mao];
    let carta=mao.splice(idx,1)[0];
    novos[0].mao=mao;
    setJogadores(novos);
    let novasFeitas={...feitas}; novasFeitas[novos[0].nome]+=1;
    setFeitas(novasFeitas);
    Alert.alert("Você jogou", carta);

    // Aqui seria chamada de função para bots jogarem e verificar rodada completa
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fodinha RN</Text>
      <Text>Vira: {vira} → Manilha: {manilha}</Text>
      <Text style={{marginTop:10,fontWeight:'bold'}}>Placar de vidas:</Text>
      {jogadores.map(j=><Text key={j.nome}>{j.nome}: {j.vidas} vidas | Feitas: {feitas[j.nome]}</Text>)}

      <Text style={{marginTop:10,fontWeight:'bold'}}>Sua mão:</Text>
      <View style={styles.mao}>{renderMao(jogadores[0].mao, roundCards===1)}</View>

      <View style={styles.botaoContainer}>
        {jogadores[0].mao.map((c,i)=>(
          <TouchableOpacity key={i} style={styles.botaoCarta} onPress={()=>jogarCarta(i)}>
            <Text style={styles.botaoText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.botao} onPress={()=>distribuir(roundCards)}>
        <Text style={styles.botaoText}>Nova Rodada</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#fff',padding:20},
  title:{fontSize:24,fontWeight:'bold',marginBottom:20,textAlign:'center'},
  mao:{flexDirection:'row',marginVertical:10,flexWrap:'wrap'},
  carta:{margin:5,fontSize:20,padding:10,borderWidth:1,borderRadius:5},
  botaoContainer:{flexDirection:'row',flexWrap:'wrap',marginTop:10},
  botaoCarta:{padding:10,borderWidth:1,borderRadius:5,margin:5,backgroundColor:'#eee'},
  botao:{backgroundColor:'#007bff',padding:10,borderRadius:5,marginTop:20,alignItems:'center'},
  botaoText:{color:'#fff',fontWeight:'bold'}
});
