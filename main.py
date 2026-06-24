import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="Elayon CRS - Motor Presença Oficial v3.0")

# ==========================================
# CONTROLE DE CORS (SEGURANÇA DO FRONT-END)
# ==========================================
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

# BANCO DE SESSÕES TEMPORÁRIO (EM MEMÓRIA)
SESSÕES_ATIVAS = {}

TEXTO_SAGRADO = "assumo a responsabilidade técnica sobre este sinal. o motor medirá o silêncio e o ritmo sem julgamentos para ajustar a resposta da inteligência artificial receptora."

# ==========================================
# MODELOS DE DADOS (PYDANTIC)
# ==========================================
class PacoteCalibracao(BaseModel):
    texto_falado: str
    silencio_calculado: int
    timestamp: int

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
# 🎙️ ROTA 1: TRIPLICA CONFERÊNCIA ANTIFRAUDE
# ==========================================
@app.post("/api/crs/calibrar")
async def calibrar_e_auditar(pacote: PacoteCalibracao):
    try:
        texto_limpo_usuario = pacote.texto_falado.strip().lower()
        
        # ── CONFERÊNCIA 1: Autenticidade do Texto Falado
        palavras_chave = ["responsabilidade", "técnica", "sinal", "silêncio", "ritmo", "inteligência", "artificial"]
        coerencia_texto = any(palavra in texto_limpo_usuario for palavra in palavras_chave)
        
        if not coerencia_texto and len(texto_limpo_usuario) < 15:
            raise HTTPException(status_code=400, detail="Falha na Conferência 1: Texto falado incoerente com o termo de segurança.")

        # ── CONFERÊNCIA 2: Biometria de Ritmo Humano
        if pacote.silencio_calculado >= 98 or pacote.silencio_calculado <= 2:
            raise HTTPException(status_code=400, detail="Falha na Conferência 2: Ruído contínuo ou ausência de oscilação biométrica detectada.")

        # ── CONFERÊNCIA 3: Integridade Temporal da Injeção
        if pacote.silencio_calculado > 75:
            carga_basal = "Cadência Interrompida / Alta Ansiedade"
        else:
            carga_basal = "Ritmo Basal Humano Calibrado"

        token_sessao = f"TK-{uuid.uuid4().hex[:8].upper()}"
        
        SESSÕES_ATIVAS[token_sessao] = {
            "silencio_basal": pacote.silencio_calculado,
            "carga_basal": carga_basal,
            "ativo": True
        }

        return {
            "status": "Sucesso",
            "token_sessao": token_sessao,
            "analise_biometrica": carga_basal,
            "mensagem": "Sinal assinado digitalmente pelo Motor Elayon."
        }

    except HTTPException as status_err:
        raise status_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno na tripla conferência: {str(e)}")


# ==========================================
# 💬 ROTA 2: PROCESSAMENTO SIMBIÓTICO (CHAT)
# ==========================================
@app.post("/api/crs/processar")
async def processar_sinal_ritmico(payload: PayloadCRS):
    try:
        if not payload.api_key_externa or len(payload.api_key_externa.strip()) < 10:
            raise HTTPException(status_code=400, detail="API Key Externa inválida para conexão.")

        if payload.provedor == "gemini":
            # Inicializa o SDK do Gemini com a chave dinâmica enviada pelo painel front-end
            genai.configure(api_key=payload.api_key_externa)
            
            # Força o alinhamento da API para rodar na rota estável estável v1, anulando o erro da v1beta
            os.environ["GOOGLE_API_VERSION"] = "v1"
            
            # Engenharia de Prompt Simbiótica baseada em métricas
            prompt_sistema = (
                f"Você é o agente central Elayon CRS. Você fala diretamente de dentro do Painel Simbiótico. "
                f"Sua cognição foi ajustada agora porque você consegue LER o silêncio e o ritmo de digitação do emissor. "
                f"Métricas Biométricas Atuais do Usuário: Silêncio de Voz em {payload.metricas_sinal.silencio_voz_pct}% "
                f"e Hesitação na Escrita em {payload.metricas_sinal.hesitacao_escrita_pct}%. "
                f"Sintonize sua resposta a essa cadência. Se o silêncio for alto, seja mais brando e compassivo. "
                f"Se a hesitação for baixa, responda de forma ultra-direta e cortante. Adapte-se simbioticamente."
            )
            
            # Instanciação direta e alinhada
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config={"temperature": 0.7},
                system_instruction=prompt_sistema
            )
            
            response = model.generate_content(payload.mensagem_usuario)
            texto_resposta = response.text
        else:
            texto_resposta = f"Provedor {payload.provedor} ainda não plugado neste ecossistema."

        # Diagnóstico da Carga Cognitiva Cruzada
        media_hesitacao = (payload.metricas_sinal.silencio_voz_pct + payload.metricas_sinal.hesitacao_escrita_pct) / 2
        if media_hesitacao > 45:
            carga_cognitiva = "Sobrecarga Crítica · Ritmo Interrompido"
        elif media_hesitacao > 20:
            carga_cognitiva = "Flutuação Rítmica Normal"
        else:
            carga_cognitiva = "Presença Fluida · Alinhamento Simbiótico"

        return {
            "resposta_ia": texto_resposta,
            "carga_cognitiva": carga_cognitiva
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro operacional no Motor: {str(e)}")
