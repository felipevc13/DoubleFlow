# extraction_service/app/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import langextract as lx
import textwrap
import os
import json
import re
from json_repair import repair_json
from langextract.data import ExampleData, Extraction # Importação 

app = FastAPI(title="LangExtract Analysis Service")

class FileAnalysisRequest(BaseModel):
    files: List[Dict[str, str]]  # Cada item: {"nome_arquivo.txt": "conteúdo..."}
    kpi_data: Optional[List[Dict[str, Any]]] = None

class AnalysisResult(BaseModel):
    filename: str
    insights: List[Dict[str, Any]]

prompt_description = textwrap.dedent("""\
    Você é um analista de dados especialista em UX Research. Sua tarefa é sintetizar dados qualitativos (feedback de texto) e quantitativos (KPIs e distribuições) de uma pesquisa para gerar insights acionáveis.
    
    Analise ambos os conjuntos de dados para encontrar correlações, validar hipóteses e identificar as dores mais impactantes.

    Para cada insight gerado, preencha os seguintes campos:
    - 'quote': Uma citação qualitativa representativa que suporta o insight.
    - 'topic': A categoria principal (ex: Usabilidade, Performance, Preço).
    - 'sentiment': O sentimento expresso (positivo, negativo, neutro).
    - 'user_need': A necessidade do usuário por trás do feedback.
    - 'evidence': A justificativa para este insight, citando se ele é baseado em dados qualitativos, quantitativos, ou ambos. Se for quantitativo, mencione o KPI.

    REGRAS DE SAÍDA ESTRITAS:
    1. Sua resposta DEVE ser APENAS o objeto JSON.
    2. NÃO inclua nenhum texto, explicação ou comentário antes ou depois do JSON.
    3. Garanta que todas as strings dentro do JSON, especialmente no campo 'quote', tenham aspas duplas (") devidamente escapadas com uma contrabarra (\\").
    4. Certifique-se de que a saída seja um JSON válido, com todas as strings devidamente fechadas e sem caracteres inválidos.
    5. Retorne no máximo 5 insights por bloco para garantir uma resposta concisa.
""")

# Função para dividir texto em blocos menores (por tamanho ou por "Pergunta:")
def split_text_content(text: str, max_chars: int = 2000) -> List[str]:
    blocks = []
    current_block = []
    current_length = 0
    lines = text.splitlines()

    for line in lines:
        line_length = len(line)
        if current_length + line_length > max_chars and current_block:
            blocks.append("\n".join(current_block))
            current_block = [line]
            current_length = line_length
        else:
            current_block.append(line)
            current_length += line_length
        if line.strip().startswith("Pergunta:") and current_block and current_length > 0:
            blocks.append("\n".join(current_block[:-1]))
            current_block = [line]
            current_length = line_length

    if current_block:
        blocks.append("\n".join(current_block))
    
    return [b for b in blocks if b.strip()]

def extract_json_string(text):
    # Extrai o maior bloco JSON entre chaves na resposta
    match = re.search(r'(\{(?:[^{}]|(?R))*\})', text, re.DOTALL)
    if match:
        return match.group(1)
    return None

async def process_block(block: str, kpi_data: Optional[List[Dict[str, Any]]], model_id: str) -> List[Dict[str, Any]]:
    quantitative_content = ""
    if kpi_data:
        try:
            kpi_json_string = json.dumps(kpi_data, indent=2, ensure_ascii=False)
            quantitative_content = f"---\nDADOS QUANTITATIVOS ---\n{kpi_json_string}"
        except TypeError:
            print("Aviso: kpi_data não pôde ser serializado para JSON.")

    text_to_analyze = f"---\nDADOS QUALITATIVOS ---\n{block}\n\n{quantitative_content}".strip()

    try:
        # 1. CONSTRUIR EXEMPLOS USANDO AS CLASSES DA BIBLIOTECA
        examples = [
            ExampleData(
                text="O aplicativo é fácil de usar, mas poderia carregar as páginas mais rápido.",
                extractions=[
                    Extraction(
                        extraction_class="Usabilidade", # Mapeado de "topic"
                        extraction_text="O aplicativo é fácil de usar, mas poderia carregar as páginas mais rápido.", # Mapeado de "quote"
                        attributes={ # O resto vai aqui dentro
                            "sentiment": "negativo",
                            "user_need": "Usuários querem uma navegação rápida e sem atrasos.",
                            "evidence": "Qualitativo. Reclama da lentidão nas páginas."
                        }
                    )
                ]
            ),
            ExampleData(
                text="Adorei a possibilidade de acompanhar a entrega em tempo real, me deixa mais tranquilo.",
                extractions=[
                    Extraction(
                        extraction_class="Rastreamento",
                        extraction_text="Adorei a possibilidade de acompanhar a entrega em tempo real, me deixa mais tranquilo.",
                        attributes={
                            "sentiment": "positivo",
                            "user_need": "Usuários querem transparência e controle sobre a entrega.",
                            "evidence": "Qualitativo. Relato direto sobre a funcionalidade de rastreamento."
                        }
                    )
                ]
            ),
            ExampleData(
                text="A interface do app ficou confusa depois da última atualização.",
                extractions=[
                    Extraction(
                        extraction_class="Design",
                        extraction_text="A interface do app ficou confusa depois da última atualização.",
                        attributes={
                            "sentiment": "negativo",
                            "user_need": "Usuários querem interfaces intuitivas, mesmo após mudanças.",
                            "evidence": "Qualitativo. Reclamação relacionada a mudanças visuais."
                        }
                    )
                ]
            )
        ]

        # A chamada para a API agora recebe os exemplos no formato correto
        result_document = lx.extract(
            text_or_documents=text_to_analyze,
            prompt_description=prompt_description,
            examples=examples,
            model_id=model_id
        )

        # 2. CONVERTER O RESULTADO DE VOLTA PARA O FORMATO JSON/DICT
        insights = []
        if result_document and result_document.extractions:
            for extraction_obj in result_document.extractions:
                # Monta o dicionário no formato que sua API espera retornar
                insight_dict = {
                    "topic": extraction_obj.extraction_class,
                    "quote": extraction_obj.extraction_text,
                    # Usa .get() para segurança caso os atributos não existam
                    "sentiment": extraction_obj.attributes.get("sentiment", "neutro"),
                    "user_need": extraction_obj.attributes.get("user_need", "Não especificada"),
                    "evidence": extraction_obj.attributes.get("evidence", "Qualitativo")
                }
                insights.append(insight_dict)

        return insights

    except Exception as e:
        print(f"Erro inesperado ao processar bloco: {e}")
        import traceback
        traceback.print_exc()
        return []   
    
    
async def process_file(file_data: Dict[str, str], kpi_data: Optional[List[Dict[str, Any]]], model_id: str) -> Dict[str, Any]:
    filename = list(file_data.keys())[0]
    content = file_data[filename]
    blocks = split_text_content(content)
    file_insights = []

    for block in blocks:
        block_insights = await process_block(block, kpi_data, model_id)
        file_insights.extend(block_insights)

    # Remove duplicados por quote
    unique_insights = []
    seen_quotes = set()
    for insight in file_insights:
        if insight["quote"] not in seen_quotes:
            unique_insights.append(insight)
            seen_quotes.add(insight["quote"])

    return {"filename": filename, "insights": unique_insights}

@app.post("/extract", response_model=List[AnalysisResult])
async def extract_data(request: FileAnalysisRequest):
    all_results = []
    model_id = os.getenv("LANGEXTRACT_MODEL_ID", "gemini-1.5-flash-latest")
    for file_data in request.files:
        result = await process_file(file_data, request.kpi_data, model_id)
        all_results.append(result)
    return all_results