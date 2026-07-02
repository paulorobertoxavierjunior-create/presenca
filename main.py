# -*- coding: utf-8 -*-
"""
Elayon Presença - Motor de Infraestrutura e Gestão de Cadência Cognitiva (CRS)
Framework: FastAPI | Versão: v3.0 Estável
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(
    title="Elayon Presença Core Engine",
    description="Motor central de processamento de ritmos biométricos e despacho adaptativo",
    version="3.0.0"
)

# Configuração Ampla do Middleware CORS para Handshake com o Git Pages/Localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite chamadas de qualquer origem física ou móvel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelagem de Dados de Entrada (Contratos Pydantic)
class MetricasRitmo(BaseModel):
    silencio_pct: int
    hesitacao_pct: int
    eventos: int

class PacoteSimbiotico(BaseModel):
    mensagem: str
    provedor: str
    api_key_externa: str
    ritmo: MetricasRitmo

# Rota de Verificação Física (Health Check)
@app.get("/")
async def health_check():
    return {
        "status": "Online",
        "engine": "Elayon CRS FastAPI",
        "infraestrutura": "Pronta para recepção biométrica"
    }

# Core de Processamento do Pipeline CRS
@app.post("/api/crs/processar")
async def processar_sinal_cognitivo(pacote: PacoteSimbiotico):
    if not pacote.mensagem or pacote.mensagem.strip() == "":
        raise HTTPException(status_code=400, detail="O buffer de texto capturado está vazio.")

    # Análise Matemática de Carga e Modulação da IA
    silencio = pacote.ritmo.silencio_pct
    hesitacao = pacote.ritmo.hesitacao_pct
    
    if silencio > 45 or hesitacao > 50:
        carga_cognitiva = "SOBRECARGA DETECTADA"
        diretriz_ia = (
            "O operador apresenta pausas longas e ritmo hesitante. "
            "Responda de forma extremamente acolhedora, clara, sem jargões e estruturada por tópicos curtos."
        )
    elif pacote.ritmo.eventos > 80 and silencio < 15:
        carga_cognitiva = "CADÊNCIA ACELERADA"
        diretriz_ia = (
            "O operador está em fluxo contínuo de pensamento rápido. "
            "Seja direto, técnico, elimine saudações prolixas e forneça a solução imediatamente."
        )
    else:
        carga_cognitiva = "ESTÁVEL / BASAL"
        diretriz_ia = "O ritmo está equilibrado. Responda de forma profissional, equilibrada e natural."

    # Processamento do Provedor de IA
    if pacote.provedor == "contingencia":
        # Modo de Segurança Local (Sem consumo de internet ou chaves)
        resposta_final = (
            f"[MODO CONTINGÊNCIA LOCAL ATIVO] Mensagem recebida com sucesso. "
            f"Seu ritmo biométrico foi computado como {carga_cognitiva}. O motor local está respondendo de forma segura."
        )
    else:
        # Integração Real e Direta com o Ecossistema Gemini
        if not pacote.api_key_externa or len(pacote.api_key_externa.strip()) < 10:
            raise HTTPException(status_code=400, detail="Chave Privada de IA inválida ou ausente no painel.")

        try:
            # Configuração explícita da API estável do Google
            genai.configure(api_key=pacote.api_key_externa.strip())
            
            # Ajuste de instruções de sistema injetando a diretriz de cadência do ritmo do usuário
            modelo_configurado = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=f"Você é o módulo de resposta do ecossistema Elayon Presença. Diretriz operacional de comportamento: {diretriz_ia}"
            )
            
            resposta_gemini = modelo_configurado.generate_content(pacote.mensagem)
            resposta_final = resposta_gemini.text

        except Exception as erro_api:
            raise HTTPException(status_code=500, detail=f"Falha na execução do modelo Gemini: {str(erro_api)}")

    # Retorno estruturado do Handshake completo
    return {
        "resposta": resposta_final,
        "analise_ritmo": {
            "carga": carga_cognitiva,
            "estabilidade_score": max(0, 100 - (silencio + hesitacao))
        },
        "telemetria": {
            "caracteres_processados": pacote.ritmo.eventos,
            "silencio_registrado": f"{silencio}%",
            "hesitacao_registrada": f"{hesitacao}%"
        }
    }

if __name__ == "__main__":
    import uvicorn
    # Inicializa o servidor local na porta 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
