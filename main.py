import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="Elayon CRS - Motor Presença Oficial")

# LIBERAÇÃO DE CORS PARA O SEU GITHUB PAGES
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

# MODELO DE ENTRADA (O que o app.js vai enviar)
class MetricasSinal(BaseModel):
    silencio_voz_pct: int
    hesitacao_escrita_pct: int
    total_intervalos: int

class PayloadCRS(BaseModel):
    mensagem_usuario: str
    provedor: str
    api_key_externa: str
    metricas_sinal: MetricasSinal

# ROTA OPERACIONAL DO MOTOR
@app.post("/api/crs/processar")
async def processar_sinal(payload: PayloadCRS):
    try:
        if not payload.api_key_externa or len(payload.api_key_externa.strip()) < 10:
            raise HTTPException(status_code=400, detail="API Key externa ausente ou inválida.")

        if payload.provedor == "gemini":
            # Inicializa o Gemini com a chave que veio direto do front-end
            genai.configure(api_key=payload.api_key_externa)
            
            # Engenharia de Prompt Simbiótica com as métricas reais
            prompt_sistema = (
                f"Você é o agente Elayon CRS. Sintonize sua resposta ao ritmo biométrico do usuário. "
                f"Métricas atuais detectadas: Silêncio de Voz em {payload.metricas_sinal.silencio_voz_pct}% "
                f"e Hesitação de Escrita em {payload.metricas_sinal.hesitacao_escrita_pct}%. "
                f"Responda de forma direta, adaptada a essa cadência."
            )
            
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=prompt_sistema
            )
            
            response = model.generate_content(payload.mensagem_usuario)
            texto_resposta = response.text
        else:
            texto_resposta = f"Provedor {payload.provedor} ainda não configurado no núcleo dinâmico."

        # Diagnóstico da Carga Cognitiva baseado no silêncio e hesitação
        media_ritmo = (payload.metricas_sinal.silencio_voz_pct + payload.metricas_sinal.hesitacao_escrita_pct) / 2
        if media_ritmo > 40:
            carga = "Sobrecarga Alta / Ritmo Interrompido"
        elif media_ritmo > 20:
            carga = "Flutuação de Cadência Detectada"
        else:
            carga = "Fluido · Presença Estável"

        return {
            "resposta_ia": texto_resposta,
            "carga_cognitiva": carga
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def healthcheck():
    return {"status": "Motor Elayon CRS Ativo", "ambiente": "Nativo Python 3"}
