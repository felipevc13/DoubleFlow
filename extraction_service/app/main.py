# app/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import json
import os
import textwrap
from pathlib import Path

# -----------------------------------------------------------------------------
# Carrega .env de forma robusta (local -> raiz do monorepo)
# -----------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    env_local = Path(__file__).resolve().parent / ".env"
    if env_local.exists():
        load_dotenv(env_local)  # extraction_service/.env
    else:
        env_root = Path(__file__).resolve().parents[1] / ".env"
        if env_root.exists():
            load_dotenv(env_root)  # ../.env
except Exception:
    # segue sem dotenv se não estiver instalado
    pass

# -----------------------------------------------------------------------------
# Gemini (novo SDK) - pip install google-genai
# -----------------------------------------------------------------------------
from google import genai

app = FastAPI(title="Analysis Service (Gemini Structured Output)")

# -----------------------------------------------------------------------------
# Models (request/response)
# -----------------------------------------------------------------------------
class FileDataItem(BaseModel):
    filename: str
    content: str   # texto puro ou JSON string (para planilha)
    category: str  # "pesquisa_usuario" | "transcricao_entrevista" | etc.

class FileAnalysisRequest(BaseModel):
    files: List[FileDataItem]

class Insight(BaseModel):
    quote: str = Field(..., description="Citação representativa")
    topic: str = Field(..., description="Categoria do insight (ex: Usabilidade)")
    sentiment: str = Field(..., description="positivo | negativo | neutro")
    user_need: str = Field(..., description="Necessidade do usuário")
    evidence: str = Field(..., description="Base qualitativa/quantitativa")

class AnalysisResult(BaseModel):
    filename: str
    insights: List[Insight]

# -----------------------------------------------------------------------------
# Config & helpers
# -----------------------------------------------------------------------------
def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY/GEMINI_API_KEY não configurada.")
    return genai.Client(api_key=api_key)

# JSON Schema puro para evitar colisões com typing.Type (Python 3.13)
INSIGHT_SCHEMA: Dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "quote": {"type": "string"},
            "topic": {"type": "string"},
            "sentiment": {"type": "string", "enum": ["positivo", "negativo", "neutro"]},
            "user_need": {"type": "string"},
            "evidence": {"type": "string"},
        },
        "required": ["quote", "topic", "sentiment", "user_need", "evidence"]
    },
}

PROMPT_SYSTEM = textwrap.dedent("""
Você é um analista de dados especialista em UX Research.
Sua tarefa é sintetizar dados qualitativos (texto) e quantitativos (KPIs) para gerar insights acionáveis.

Para cada insight, preencha:
- "quote": citação representativa (texto do usuário)
- "topic": categoria (ex: Usabilidade, Performance)
- "sentiment": positivo | negativo | neutro
- "user_need": necessidade do usuário
- "evidence": diga se veio de qualitativo, quantitativo, ou ambos. Se quantitativo, mencione o KPI.

REGRAS:
- Retorne APENAS JSON válido (array de objetos).
- No máximo 5 insights por bloco.
""").strip()

def split_text_content(text: str, max_chars: int = 3500) -> List[str]:
    text = text or ""
    if not text.strip():
        return []
    blocks: List[str] = []
    buf: List[str] = []
    current = 0
    for line in text.splitlines():
        ln = line.strip("\n")
        if current + len(ln) + 1 > max_chars and buf:
            blocks.append("\n".join(buf))
            buf = [ln]
            current = len(ln) + 1
        else:
            buf.append(ln)
            current += len(ln) + 1
    if buf:
        blocks.append("\n".join(buf))
    return [b for b in blocks if b.strip()]

def try_json_loads(s: str) -> Optional[Any]:
    try:
        return json.loads(s)
    except Exception:
        return None

def blocks_for_file(item: FileDataItem) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    - Se category == 'pesquisa_usuario', espera content como JSON string:
      { quantitativeKPIs: [...], qualitativeData: [{ pergunta, respostas: [...] }, ...] }
      Converte cada pergunta+respostas em um bloco de texto.
    - Caso contrário, trata content como texto puro (transcrição, etc) e faz chunking.
    """
    if item.category == "pesquisa_usuario":
        parsed = try_json_loads(item.content)
        if not isinstance(parsed, dict):
            return (split_text_content(item.content), [])
        kpis = parsed.get("quantitativeKPIs", []) or []
        qblocks: List[str] = []
        for q in parsed.get("qualitativeData", []):
            pergunta = (q or {}).get("pergunta", "")
            respostas = (q or {}).get("respostas", [])
            if not pergunta or not isinstance(respostas, list) or not respostas:
                continue
            block = "Pergunta: " + pergunta.strip() + "\n" + "\n".join(
                [str(r) for r in respostas if isinstance(r, str) and r.strip()]
            )
            if block.strip():
                qblocks.extend(split_text_content(block))
        return (qblocks, kpis)
    else:
        return (split_text_content(item.content), [])

def build_block_input(block: str, kpis: List[Dict[str, Any]]) -> str:
    kpi_part = ""
    if kpis:
        try:
            kpi_part = "\n\n---\nDADOS QUANTITATIVOS (KPIs)\n" + json.dumps(
                kpis, ensure_ascii=False, indent=2
            )
        except Exception:
            kpi_part = "\n\n---\nDADOS QUANTITATIVOS: [falha ao serializar]"
    return f"DADOS QUALITATIVOS\n{block.strip()}{kpi_part}"

async def call_gemini_structured(client: genai.Client, model_id: str, content: str) -> List[Dict[str, Any]]:
    """
    Usa apenas role 'user' (o SDK não aceita 'system' em contents).
    Colamos o PROMPT_SYSTEM + conteúdo em uma única mensagem.
    """
    try:
        resp = client.models.generate_content(
            model=model_id,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                f"{PROMPT_SYSTEM}\n\n"
                                "### DADOS PARA ANÁLISE\n"
                                f"{content}"
                            )
                        }
                    ],
                }
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": INSIGHT_SCHEMA,  # já sem additionalProperties
                "temperature": 0.2,
                "top_p": 0.9,
                "top_k": 40,
            },
        )
        raw = resp.text
        parsed = try_json_loads(raw)
        if isinstance(parsed, list):
            cleaned: List[Dict[str, Any]] = []
            for it in parsed[:5]:
                if not isinstance(it, dict):
                    continue
                quote = (it.get("quote") or "").strip()
                topic = (it.get("topic") or "").strip()
                sentiment = (it.get("sentiment") or "").strip()
                user_need = (it.get("user_need") or "").strip()
                evidence = (it.get("evidence") or "").strip()
                if not quote or not topic:
                    continue
                if sentiment not in {"positivo", "negativo", "neutro"}:
                    sentiment = "neutro"
                cleaned.append(
                    {
                        "quote": quote,
                        "topic": topic,
                        "sentiment": sentiment,
                        "user_need": user_need or "Não especificada",
                        "evidence": evidence or "Qualitativo",
                    }
                )
            return cleaned
        return []
    except Exception as e:
        print(f"[ERR] Gemini structured output falhou: {e}")
        return []


def dedupe_by_quote(insights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for ins in insights:
        q = ins.get("quote", "").strip()
        if not q or q in seen:
            continue
        seen.add(q)
        out.append(ins)
    return out

# -----------------------------------------------------------------------------
# Endpoint principal
# -----------------------------------------------------------------------------
@app.post("/extract", response_model=List[AnalysisResult])
async def extract_data(request: FileAnalysisRequest):
    """
    Processa arquivos (texto/JSON de pesquisa) e retorna insights por arquivo.
    """
    model_id = os.getenv("GEMINI_MODEL_ID", "gemini-1.5-flash-8b")
    try:
        client = get_gemini_client()
    except RuntimeError as e:
        # Não quebra o caller: retorna OK com vazio se chave não estiver configurada
        print("[WARN]", e)
        return [
            AnalysisResult(filename=f.filename, insights=[])
            for f in request.files
        ]

    results: List[AnalysisResult] = []
    print(f"[extract] Processando {len(request.files)} arquivo(s) com {model_id}")

    for file_item in request.files:
        blocks, kpis = blocks_for_file(file_item)
        all_insights: List[Dict[str, Any]] = []

        if not blocks:
            print(f"[extract] AVISO: sem blocos válidos em '{file_item.filename}' (category={file_item.category})")

        for block in blocks:
            content_for_model = build_block_input(block, kpis)
            insights = await call_gemini_structured(client, model_id, content_for_model)
            all_insights.extend(insights)

        unique = dedupe_by_quote(all_insights)
        if len(unique) > 60:
            unique = unique[:60]

        results.append(AnalysisResult(filename=file_item.filename, insights=unique))

    return results

# -----------------------------------------------------------------------------
# Healthcheck (expõe has_key para debug sem vazar a chave)
# -----------------------------------------------------------------------------
@app.get("/healthz")
def healthz():
    has_key = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))
    try:
        _ = get_gemini_client()
        ok = True
    except Exception:
        ok = False
    return {"ok": ok, "has_key": has_key, "time": datetime.utcnow().isoformat() + "Z"}
