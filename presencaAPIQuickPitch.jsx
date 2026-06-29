```react
import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Shield, Cpu, Database, Server, FileCode, Play, CheckCircle, 
  AlertTriangle, Key, ChevronRight, ChevronDown, RefreshCw, Send, Copy, Mic
} from 'lucide-react';

// === ARQUIVOS DE ARQUITETURA PRÉ-CARREGADOS (DOCS/) ===
const DOCUMENTOS_PRESENCA = {
  'core/ARCHITECTURE.md': `# Arquitetura Geral - Elayon Presença
Este módulo descreve a integridade geral do sistema de biometria e presença.

## Camadas Fundamentais
1. **Interface do Cockpit (Frontend):** Responsável por capturar oscilações de áudio através da API WebAudio.
2. **Camada de Orquestração de Segurança:** Envia pacotes criptografados para o Backend no Render.
3. **Engine do Supabase:** Responsável pelo controle de sessão de voo e registro do ID do piloto.

## Regras de Execução
- Nenhuma chave de API deve ser exposta diretamente no cliente.
- Toda validação de biometria temporal de voz deve passar pelo algoritmo CRS (Cálculo de Razão de Sincronia).`,

  'core/AI_CONTROL_PROTOCOL.md': `# Protocolo de Controle e Governança de IA (A_C_P)
Este protocolo estabelece limites de alteração autônoma do banco de dados e backend por agentes de IA.

## Limites de Gravação
- IA pode sugerir e gerar migrações SQL para o Supabase.
- IA **não pode** executar comandos de exclusão em massa sem aprovação manual do piloto chefe.
- As chamadas de IA devem obrigatoriamente validar o cabeçalho 'x-elayon-signature'.`,

  'runtime/STATE_MACHINE.md': `# Máquina de Estado Temporal do Piloto
Controle dinâmico de conexões de presença biométrica em tempo real.

## Estados da Sessão:
- **OFFLINE (0):** Piloto desconectado do painel.
- **ACOPLANDO (1):** Aguardando hardware de áudio e validação de frequência de voz.
- **AUTENTICADO (2):** Token gerado, banco Supabase atualizado, sessão de cockpit liberada.
- **CORROMPIDO (3):** Tentativa de fraude biométrica detectada. Bloqueio automático.`,

  'system/SYSTEM_BOOT_SEQUENCE.md': `# Sequência de Boot de Hardware e Software - Presença
Passos lógicos executados na inicialização do Cockpit.

1. **Boot_Stage_1:** Inicialização da interface visual Elayon Space.
2. **Boot_Stage_2:** Teste de handshake com o Servidor no Render.
3. **Boot_Stage_3:** Tentativa de login anônimo / Autenticação customizada com o Supabase.
4. **Boot_Stage_4:** Ativação do microfone para análise de ruído espectral e biometria CRS.`
};

```react
export default function App() {
  // --- Estados do Sistema ---
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'assistant', text: 'Saudações, Piloto. O motor cognitivo do Elayon Presença está operacional. Selecione os documentos da arquitetura no painel lateral para alimentar meu contexto.' }
  ]);
  const [selectedDocs, setSelectedDocs] = useState(['core/ARCHITECTURE.md']);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ia-terminal'); // ia-terminal, biometria, db-render
  const [apiResponseCode, setApiResponseCode] = useState('');
  const [expandedFolder, setExpandedFolder] = useState({ core: true, runtime: true, system: true });
  const [statusNotification, setStatusNotification] = useState(null);

  // --- Estados da Biometria Simulada ---
  const [isCapturing, setIsCapturing] = useState(false);
  const [biometricScore, setBiometricScore] = useState(0);
  const [authStatus, setAuthStatus] = useState('DESCONECTADO'); // DESCONECTADO, PROCESSANDO, AUTENTICADO
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // --- Notificações Customizadas ---
  const showNotification = (message, type = 'info') => {
    setStatusNotification({ message, type });
    setTimeout(() => setStatusNotification(null), 4000);
  };

  // --- Função de Chamada da API Gemini com Backoff Exponencial ---
  const callGeminiAPI = async (userPrompt, fullContext) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const systemPrompt = `Você é a Inteligência Artificial integrada ao ecossistema Elayon Presença.
Seu objetivo é analisar os documentos de arquitetura fornecidos e auxiliar o programador sênior a desenvolver a API (server.js), conexões com o Supabase e implantações no Render.
Regras:
1. Sempre responda em Português.
2. Se o usuário pedir um código, escreva códigos limpos e funcionais, devidamente comentados.
3. Baseie suas decisões arquiteturais estritamente nos documentos fornecidos como contexto.`;

    const payload = {
      contents: [
        {
          parts: [
            { text: `CONTEXTO DA ARQUITETURA SELECIONADA:\n\n${fullContext}\n\nPERGUNTA/ORDEM DE PROGRAMAÇÃO:\n${userPrompt}` }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      }
    };

    let delay = 1000;
    const maxRetries = 5;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Erro na API Gemini: Status ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        throw new Error("Resposta vazia da API do Gemini.");
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial
      }
    }
  };

```react
  // --- Submissão do Prompt ao Copiloto Elayon ---
  const handleSendPrompt = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (!apiKey) {
      showNotification('Precisa de introduzir a sua chave da API do Gemini para executar as consultas!', 'error');
      return;
    }

    const currentPrompt = prompt;
    setPrompt('');
    setChatLog(prev => [...prev, { role: 'user', text: currentPrompt }]);
    setIsLoading(true);

    // Compila os documentos marcados como contexto
    let combinedContext = '';
    selectedDocs.forEach(docName => {
      combinedContext += `--- Documento: ${docName} ---\n${DOCUMENTOS_PRESENCA[docName]}\n\n`;
    });

    try {
      const responseText = await callGeminiAPI(currentPrompt, combinedContext);
      
      // Tenta extrair blocos de código para renderizar na lateral se existirem
      const codeBlockRegex = /


      const match = codeBlockRegex.exec(responseText);
      if (match && match[1]) {
        setApiResponseCode(match[1]);
      }

      setChatLog(prev => [...prev, { role: 'assistant', text: responseText }]);
    } catch (error) {
      setChatLog(prev => [...prev, { role: 'assistant', text: `Ocorreu um erro na requisição: ${error.message}. Verifique a sua chave ou conectividade.` }]);
      showNotification('Erro na comunicação com a IA.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Alternar Seleção de Documentos para o Contexto ---
  const toggleDocSelection = (docPath) => {
    if (selectedDocs.includes(docPath)) {
      if (selectedDocs.length === 1) {
        showNotification('Mantenha pelo menos um documento no contexto da IA!', 'warning');
        return;
      }
      setSelectedDocs(selectedDocs.filter(d => d !== docPath));
    } else {
      setSelectedDocs([...selectedDocs, docPath]);
    }
  };

  // --- Animação do Canvas de Captura de Áudio (Biometria) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Linha de base da rede espectral (Grelha)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 30) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // Desenha as ondas senoidais simulando biometria espectral
      const numWaves = 3;
      const colors = ['#10b981', '#3b82f6', '#8b5cf6'];
      
      for (let w = 0; w < numWaves; w++) {
        ctx.beginPath();
        ctx.lineWidth = w === 0 ? 3 : 1.5;
        ctx.strokeStyle = isCapturing ? colors[w] : 'rgba(156, 163, 175, 0.3)';

        for (let x = 0; x < canvas.width; x++) {
          const amplitude = isCapturing 
            ? (Math.sin(x * 0.005 + phase * 0.1) * 30 + Math.cos(x * 0.02 - phase * 0.05) * 10) * (w === 0 ? 1 : 0.6)
            : Math.sin(x * 0.01) * 2; // onda quase estática se desligado
          const y = canvas.height / 2 + amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isCapturing]);

  // --- Controle da Ação de Autenticação Biométrica ---
  const startBiometricHandshake = () => {
    if (isCapturing) {
      setIsCapturing(false);
      setAuthStatus('DESCONECTADO');
      setBiometricScore(0);
      showNotification('Hardware de áudio desacoplado.', 'warning');
      return;
    }

    setIsCapturing(true);
    setAuthStatus('PROCESSANDO');
    showNotification('A acoplar o Hardware de Áudio. A ajustar taxa de amostragem CRS...');

    let score = 0;
    const interval = setInterval(() => {
      score += Math.floor(Math.random() * 15) + 5;
      if (score >= 100) {
        score = 100;
        clearInterval(interval);
        setAuthStatus('AUTENTICADO');
        showNotification('Autenticação CRS bem-sucedida! Sessão persistida no Supabase.', 'success');
      }
      setBiometricScore(score);
    }, 400);
  };

  const copyToClipboard = (text) => {
    try {
      navigator.clipboard.writeText(text);
      showNotification('Código copiado para a área de transferência!', 'success');
    } catch (err) {
      const textAreax = document.createElement("textarea");
      textAreax.value = text;
      document.body.appendChild(textAreax);
      textAreax.select();
      document.execCommand('copy');
      document.body.removeChild(textAreax);
      showNotification('Código copiado com sucesso!', 'success');
    }
  };

```react
  // === CONTINUAÇÃO DA PARTE 3 (COLE ESTE BLOCO LOGO ABAIXO DA PARTE 3) ===

  return (
    <div className="min-h-screen bg-[#060a13] text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-[#060a13]">
      {/* --- NOTIFICAÇÃO FLUTUANTE --- */}
      {statusNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-2xl flex items-center gap-3 border transition-all duration-300 ${
          statusNotification.type === 'error' ? 'bg-red-950/90 border-red-500 text-red-200' :
          statusNotification.type === 'success' ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' :
          statusNotification.type === 'warning' ? 'bg-yellow-950/90 border-yellow-500 text-yellow-200' :
          'bg-slate-900/90 border-blue-500 text-blue-200'
        }`}>
          {statusNotification.type === 'error' ? <AlertTriangle className="animate-bounce" /> : <CheckCircle />}
          <span className="text-sm font-medium">{statusNotification.message}</span>
        </div>
      )}

      {/* --- HEADER DO COCKPIT --- */}
      <header className="border-b border-gray-800 bg-[#0a0f1d] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <Cpu className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">V1.4-PRO</span>
              <h1 className="text-lg font-bold tracking-wider text-white uppercase">Elayon Presença</h1>
            </div>
            <p className="text-xs text-gray-400">Plataforma de Engenharia Cognitiva e Controle Biométrico</p>
          </div>
        </div>

        {/* Configuração Rápida de Chave */}
        <div className="flex items-center gap-2 bg-[#121829] border border-gray-700 rounded-lg px-3 py-1.5 w-full md:w-auto max-w-sm">
          <Key className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <input
            type="password"
            placeholder="Insira a sua Gemini API Key..."
            className="bg-transparent text-xs outline-none text-gray-200 w-full placeholder-gray-500"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      </header>

{/* --- CORPO PRINCIPAL --- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* === PAINEL LATERAL ESQUERDO: EXPLORADOR DE ARQUITETURA === */}
        <aside className="w-full lg:w-80 border-r border-gray-800 bg-[#080d1a] p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-400" />
              Arquitetura Presença
            </span>
            <span className="text-[10px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
              {Object.keys(DOCUMENTOS_PRESENCA).length} Docs
            </span>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Selecione quais os módulos e especificações de governança que serão lidos pela IA para embasar as respostas de programação.
          </p>

          <div className="space-y-3 mt-2 overflow-y-auto max-h-[300px] lg:max-h-none flex-1 pr-1">
            {/* Diretório Core */}
            <div>
              <button 
                onClick={() => setExpandedFolder(prev => ({ ...prev, core: !prev.core }))}
                className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-300 hover:text-white"
              >
                {expandedFolder.core ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-emerald-400">core/</span>
              </button>
              {expandedFolder.core && (
                <div className="pl-4 mt-1 space-y-1.5 border-l border-gray-800 ml-2">
                  {['core/ARCHITECTURE.md', 'core/AI_CONTROL_PROTOCOL.md'].map((doc) => (
                    <label 
                      key={doc} 
                      className="flex items-start gap-2.5 p-2 rounded cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        className="mt-0.5 accent-emerald-500"
                        checked={selectedDocs.includes(doc)}
                        onChange={() => toggleDocSelection(doc)}
                      />
                      <span className={`text-xs ${selectedDocs.includes(doc) ? 'text-emerald-300 font-medium' : 'text-gray-400'}`}>
                        {doc.split('/')[1]}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Folder Runtime */}
            <div>
              <button 
                onClick={() => setExpandedFolder(prev => ({ ...prev, runtime: !prev.runtime }))}
                className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-300 hover:text-white"
              >
                {expandedFolder.runtime ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-blue-400">runtime/</span>
              </button>
             
{expandedFolder.runtime && (
                <div className="pl-4 mt-1 space-y-1.5 border-l border-gray-800 ml-2">
                  {['runtime/STATE_MACHINE.md'].map((doc) => (
                    <label 
                      key={doc} 
                      className="flex items-start gap-2.5 p-2 rounded cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        className="mt-0.5 accent-blue-500"
                        checked={selectedDocs.includes(doc)}
                        onChange={() => toggleDocSelection(doc)}
                      />
                      <span className={`text-xs ${selectedDocs.includes(doc) ? 'text-blue-300 font-medium' : 'text-gray-400'}`}>
                        {doc.split('/')[1]}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Folder System */}
            <div>
              <button 
                onClick={() => setExpandedFolder(prev => ({ ...prev, system: !prev.system }))}
                className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-300 hover:text-white"
              >
                {expandedFolder.system ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="text-purple-400">system/</span>
              </button>
              {expandedFolder.system && (
                <div className="pl-4 mt-1 space-y-1.5 border-l border-gray-800 ml-2">
                  {['system/SYSTEM_BOOT_SEQUENCE.md'].map((doc) => (
                    <label 
                      key={doc} 
                      className="flex items-start gap-2.5 p-2 rounded cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <input 
type="checkbox" 
                        className="mt-0.5 accent-purple-500"
                        checked={selectedDocs.includes(doc)}
                        onChange={() => toggleDocSelection(doc)}
                      />
                      <span className={`text-xs ${selectedDocs.includes(doc) ? 'text-purple-300 font-medium' : 'text-gray-400'}`}>
                        {doc.split('/')[1]}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Monitor */}
          <div className="bg-[#0c1324] border border-gray-800 rounded-lg p-3.5 space-y-2 mt-auto">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Auditoria de Processamento
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Assinatura Local:</span>
              <span className="text-emerald-400 font-mono font-semibold">CRS Sincronizado</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Nuvem Render:</span>
              <span className="text-blue-400 font-mono font-semibold">Active Engine</span>
            </div>
          </div>
        </aside>

        {/* === ÁREA CENTRAL: SISTEMAS INTERATIVOS === */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#050811]">
          
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800">
            {/* Navegação por Abas */}
            <div className="flex border-b border-gray-800 bg-[#080d1a]">
              <button 
                onClick={() => setActiveTab('ia-terminal')}
                className={`flex-1 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'ia-terminal' 
                    ? 'border-emerald-500 bg-emerald-500/5 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#0d152a]'
                }`}
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                Terminal IA
              </button>
              
              <button 
                onClick={() => setActiveTab('biometria')}
                className={`flex-1 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'biometria' 
                    ? 'border-emerald-500 bg-emerald-500/5 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#0d152a]'
                }`}
              >
                <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                Biometria CRS
              </button>

              <button 
                onClick={() => setActiveTab('db-render')}
                className={`flex-1 py-3 px-4 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'db-render' 
                    ? 'border-emerald-500 bg-emerald-500/5 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#0d152a]'
                }`}
              >
                <Server

className="w-4 h-4 text-emerald-400" />
                Supabase & Render
              </button>
            </div>

            {/* Conteúdo da Aba Ativa */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
              
              {/* ABA 1: TERMINAL DE IA INTEGRADO COM GEMINI */}
              {activeTab === 'ia-terminal' && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  <div className="space-y-4 mb-4 overflow-y-auto flex-1 max-h-[420px]">
                    {chatLog.map((message, idx) => (
                      <div 
                        key={idx} 
                        className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                      >
                        <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center border flex-shrink-0 ${
                          message.role === 'user' 
                            ? 'bg-blue-950 border-blue-500 text-blue-200' 
                            : 'bg-emerald-950 border-emerald-500 text-emerald-200'
                        }`}>
                          {message.role === 'user' ? 'P' : 'IA'}
                        </div>
                        <div className={`p-3 rounded-lg text-xs leading-relaxed whitespace-pre-wrap shadow-md ${
                          message.role === 'user' 
                            ? 'bg-blue-950/45 border border-blue-900 text-blue-100' 
                            : 'bg-slate-900 border border-gray-800 text-gray-100'
                        }`}>
                          {message.text}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                        <div className="p-2 rounded-full h-8 w-8 flex items-center justify-center border bg-emerald-950 border-emerald-500 text-emerald-200 animate-spin">
                          <RefreshCw className="w-4 h-4" />
                        </div>
                        <span className="text-xs text-gray-400 animate-pulse">A calcular vetor estrutural de resposta...</span>
                      </div>
                    )}
                  </div>

                  {/* Entrada do Chat */}
                  <form onSubmit={handleSendPrompt} className="mt-auto border-t border-gray-800 pt-4 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-[#101626] border border-gray-700 rounded-lg px-4 py-3 text-xs outline-none focus:border-emerald-500 text-gray-100 placeholder-gray-500"
                      placeholder={apiKey ? "Peça à IA para reescrever o backend ou estruturar tabelas do Supabase..." : "Insira a sua API Key do Gemini no cabeçalho para destravar o terminal..."}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isLoading || !apiKey}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !apiKey || !prompt.trim()}

className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-4 py-3 rounded-lg flex items-center justify-center disabled:opacity-40 disabled:hover:bg-emerald-500 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* ABA 2: OSCILOSCÓPIO CRS BIOMETRIA */}
              {activeTab === 'biometria' && (
                <div className="flex-grow flex flex-col justify-between h-full space-y-4">
                  <div className="bg-[#0a0f1d] border border-gray-800 rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Análise de Razão de Sincronia CRS</h3>
                        <p className="text-xs text-gray-400">Leitura contínua dos hiatos de fonação do piloto</p>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded border ${
                        authStatus === 'AUTENTICADO' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        authStatus === 'PROCESSANDO' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse' :
                        'bg-gray-500/15 text-gray-400 border-gray-500/30'
                      }`}>
                        {authStatus}
                      </span>
                    </div>

                    <div className="relative rounded-lg overflow-hidden border border-gray-800 h-44 bg-[#0a0f1d]">
                      <canvas 
                        ref={canvasRef} 
                        width={600} 
                        height={176} 
                        className="w-full h-full block"
                      />
                      {isCapturing && (
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[#060a13]/80 px-2 py-0.5 rounded border border-emerald-500/20 text-[9px] text-emerald-400">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          ESPECTRO ATIVO (WEB AUDIO)
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#121829] border border-gray-800 rounded-lg p-3">
                        <span className="text-[10px] text-gray-400 block uppercase">Padrão de Silêncio CRS</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span

className="text-xl font-mono font-bold text-emerald-400">{biometricScore}%</span>
                          <span className="text-[10px] text-gray-500">Mínimo: 92%</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${biometricScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-[#121829] border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Assinatura de Frequência</span>
                          <span className="text-xs text-gray-300 mt-1 block">Espectro: {isCapturing ? '128.4 Hz' : '0.0 Hz'}</span>
                        </div>
                        <span className="text-[10px] text-emerald-500 font-mono mt-1">Sinal Seguro</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={startBiometricHandshake}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold tracking-wider uppercase transition-all shadow-lg ${
                      isCapturing 
                        ? 'bg-red-500 hover:bg-red-400 text-white' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-gray-950'
                    }`}
                  >
                    <Mic className={`w-5 h-5 ${isCapturing ? 'animate-bounce' : ''}`} />
                    {isCapturing ? 'Desacoplar Escuta CRS' : 'Acoplar Escuta CRS'}
                  </button>
                </div>
              )}

              {/* ABA 3: DATABASE & HOSTING LOGS */}
              {activeTab === 'db-render' && (
                <div className="flex-grow flex flex-col gap-4">
                  <div className="bg-[#0a0f1d] border border-gray-800 rounded-lg p-4 space-y-4">
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      Estrutura de Tabelas (Supabase Integration)
                    </h3>
                    
                    <p className="text-xs text-gray-400">
                      O schema mapeia as credenciais de acesso seguro do piloto e o vetor FIFO gerado a cada ciclo.
                    </p>

                    <div className="bg-[#050811] border border-gray-800 rounded-lg p-3 font-mono text-[11px] text-gray-300 overflow-x-auto space-y-1">
                      <div><span className="text-purple-400">CREATE TABLE</span> public.presenca_pilotos (</div>
                      <div className="pl-4">id <span className="text-blue-400">UUID PRIMARY KEY DEFAULT</span> gen_random_uuid(),</div>
                      <div className="pl-4">piloto_id <span className="text-blue-400">UUID REFERENCES</span> auth.users(id),</div>
                      <div className="pl-4">sincronia_crs_percent <span className="text-green-400">INT</span>,</div>
                      <div className="pl-4">status_presenca <span className="text-green-400">VARCHAR</span> DEFAULT <span className="text-yellow-400">'ativo'</span>,</div>
                      <div className="pl-4">last_ping_at <span className="text-blue-400">TIMESTAMP WITH TIME ZONE</span> DEFAULT clock_timestamp()</div>
                      <div>);</div>
                    </div>
                  </div>

<div className="bg-[#0a0f1d] border border-gray-800 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-400" />
                      Configuração Cloud (Render variables)
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 bg-[#121829] rounded border border-gray-800">
                        <span className="font-mono text-gray-400">DATABASE_URL</span>
                        <span className="text-blue-300 font-mono">postgres://...supabase.co:5432</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-[#121829] rounded border border-gray-800">
                        <span className="font-mono text-gray-400">SUPABASE_SERVICE_ROLE</span>
                        <span className="text-blue-300 font-mono">•••••••••••••••••••••</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* === PAINEL LATERAL DIREITO: GERADOR DE CÓDIGO DA IA === */}
          <div className="w-full lg:w-[480px] bg-[#080d1a] border-t lg:border-t-0 border-gray-800 p-4 flex flex-col justify-between">
            <div className="space-y-4 flex-grow flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    Painel do Engenheiro (Código)
                  </span>
                  {apiResponseCode && (
                    <button 
                      onClick={() => copyToClipboard(apiResponseCode)}
                      className="p-1.5 bg-[#121829] border border-gray-700 rounded text-gray-300 hover:text-white hover:bg-slate-900 flex items-center gap-1.5 text-[10px]"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Os blocos de código (server.js, rotas do Express, ou tabelas SQL) gerados pelo copiloto aparecem automaticamente neste terminal lateral.
                </p>
              </div>

              {/* Bloco Editor de Visualização de Código */}
              <div className="flex-1 mt-4 relative bg-[#040710] border border-gray-800 rounded-lg p-3 font-mono text-xs overflow-auto max-h-[350px] lg:max-h-none text-emerald-300">
                {apiResponseCode ? (
                  <pre className="whitespace-pre">{apiResponseCode}</pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 p-6">
                    <FileCode className="w-8 h-8 text-gray-700" />
                    <p className="text-xs">Nenhum bloco de código gerado no momento.</p>
                    <p className="text-[10px] text-gray-600">Peça ao copiloto de IA no chat central para "escrever o backend do Render" ou "criar migrações SQL no Supabase".</p>
                  </div>
                )}
              </div>

              {/* Botão de Deploy Simulado */}
              <div className="border-t border-gray-800 pt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (!apiResponseCode) {
                      showNotification('Gere um código com a IA antes de simular o commit!', 'warning');
                      return;
                    }
                    showNotification('Código commitado! Disparando Build automatizada no Render...', 'success');
                  }}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-lg font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow"
                >
                  <Play className="w-4 h-4" /> Comitar para Render
                </button>
              </div>
            </div>
          </div>

        </main>
      </div>

{/* --- RODAPÉ DE STATUS --- */}
      <footer className="border-t border-gray-800 bg-[#0a0f1d] px-6 py-3 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-500 gap-2">
        <span>© 2026 Ecossistema Elayon - Todos os Direitos Reservados</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" /> Core Ativo</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Handshake Supabase</span>
        </div>
      </footer>
    </div>
  );
}

