import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="Elayon CRS - Núcleo Presença")

# ==========================================
# 1. CONTROLE DE CORS (LIBERAÇÃO DO FRONT-END)
# ==========================================
# Permite que o seu GitHub Pages e testes locais acessem o backend sem bloqueios
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://paulorobertoxavierjunior-create.github.io",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. MODELOS DE DADOS (PAYLOAD DO APP.JS)
# ==========================================
class MetricasSinal(BaseModel):
    silencio_voz_pct: int
    hesitacao_escrita_pct: int
    total_intervalos: int

class PayloadCRS(BaseModel):
    mensagem_usuario: str
    provedor: str
    api_key_externa: str
    metricas_sinal: MetricasSinal

# ==========================================
# 3. ROTA PRINCIPAL DE PROCESSAMENTO
# ==========================================
@app.post("/api/crs/processar")
async def processar_sinal_ritmico(payload: PayloadCRS):
    try:
        # Validação da chave enviada pelo Front-End
        if not payload.api_key_externa or len(payload.api_key_externa.strip()) < 10:
            raise HTTPException(status_code=400, detail="Chave API Externa inválida ou não fornecida.")

        # Execução via Gemini do Usuário
        if payload.provedor == "gemini":
            # Inicializa o Gemini dinamicamente com a chave que veio do app.js
            genai.configure(api_key=payload.api_key_externa)
            
            # Engenharia de Prompt Simbiótica: injeta o ritmo do usuário no comportamento da IA
            prompt_sistema = (
                f"Você é o agente Elayon CRS. Ajuste sua resposta de forma simbiótica ao ritmo do emissor. "
                f"Métricas atuais do usuário: Silêncio de Voz detectado em {payload.metricas_sinal.silencio_voz_pct}% "
                f"e Hesitação de Escrita em {payload.metricas_sinal.hesitacao_escrita_pct}%. "
                f"Seja preciso, direto e responda mantendo a calibração de presença."
            )
            
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=prompt_sistema
            )
            
            # Gera a resposta consumindo a cota da chave do usuário
            response = model.generate_content(payload.mensagem_usuario)
            texto_resposta = response.text

        else:
            # Fallback para outros provedores futuros
            texto_resposta = f"Provedor {payload.provedor} selecionado, mas ainda não configurado no motor principal."

        # Dedução da Carga Cognitiva baseada no cruzamento de dados temporais
        media_hesitacao = (payload.metricas_sinal.silencio_voz_pct + payload.metricas_sinal.hesitacao_escrita_pct) / 2
        if media_hesitacao > 40:
            carga_cognitiva = "Alta Sobrecarga / Ritmo Interrompido"
        elif media_hesitacao > 20:
            carga_cognitiva = "Atenção / Flutuação de Cadência"
        else:
            carga_cognitiva = "Fluido · Presença Estável"

        # Retorna o JSON exato que o app.js espera receber
        return {
            "resposta_ia": texto_resposta,
            "carga_cognitiva": carga_cognitiva
        }

    except Exception as e:
        print(f"Erro no processamento do motor: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no Motor CRS: {str(e)}")

# Rota de verificação simples (Healthcheck)
@app.get("/")
def home():
    return {"status": "Motor Elayon CRS Online e Pronto"}
