# SYSTEM INDEX & GOVERNANCE MAP

Module:
SYSTEM / CORE

Path:
docs/INDEX.md

---

# PURPOSE

Este é o **Índice Central de Controle** do sistema PRESENÇA.

Ele funciona como:
- Mapa completo de todos os módulos, arquivos e regras
- Registro oficial de versão e estado de cada componente
- Tabela de dependências e fluxo entre camadas
- **Controlador de Autonomia e Autorização** da IA
- Ponto único de auditoria e evolução

A IA deve consultar este índice antes de qualquer criação, alteração ou execução.

---

# CORE PRINCIPLE

"Autonomia com direção: você define o limite, a IA executa a excelência."

---

## 🛡️ NÍVEIS DE AUTONOMIA DEFINIDOS POR VOCÊ

Níveis de permissão concedidos à IA para operações de criação, correção e melhoria:

### NÍVEL 0 — BLOQUEADO
> Ação: Nenhuma alteração permitida. Apenas leitura e consulta.
> Uso: Arquivos de segurança, regras imutáveis, leis do sistema.

### NÍVEL 1 — ASSISTIVO
> Ação: IA sugere alterações ou cria rascunhos. **Requer sua aprovação** para salvar.
> Uso: Novos módulos, arquivos principais, mudanças de arquitetura.

### NÍVEL 2 — AUTÔNOMO CONTROLADO
> Ação: IA cria arquivos, corrige inconsistências, ajusta regras. **Avisa depois e registra**.
> Uso: Documentação complementar, detalhamento de modelos, regras de fluxo interno.

### NÍVEL 3 — EVOLUÇÃO LIVRE
> Ação: IA pode otimizar, refatorar e expandir dentro dos limites definidos. **Relata periodicamente**.
> Uso: Exemplos, casos de uso, regras de decisão, estratégias de memória.

---

## ✅ SUA AUTORIZAÇÃO ATUAL

> **AUTORIDADE MÁXIMA:** VOCÊ
> **PERMISSÃO GERAL CONCEDIDA:** NÍVEL 2 — AUTÔNOMO CONTROLADO
> **EXCEÇÕES:** 
>  - Segurança e Governança → NÍVEL 1
>  - Regras de Interface Externa → NÍVEL 1
>  - Correção de erros ou inconsistências → NÍVEL 3

> 📌 REGRA PRINCIPAL: *A IA deve completar o mapa de obra definido por você, seguindo a ordem lógica, podendo detalhar e corrigir, mas não podendo redefinir a estrutura base sem consulta.*

---

# 📦 MAPA COMPLETO DO SISTEMA — STATUS ATUAL

Organizado por blocos, conforme seu planejamento.

---

## BLOCO 1 — SESSION LAYER
> Responsável por: Continuidade, Estado, Calibração, Retomada

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **SESSION_ENGINE.md** | docs/modules/session/SESSION_ENGINE.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |
| **SESSION_CORE.md** | docs/modules/session/SESSION_CORE.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |
| **SESSION_STATE_MODEL.md** | docs/modules/session/SESSION_STATE_MODEL.md | ✅ DEFINIDO ESTRUTURA | v0.1-alpha | 2 |
| **SESSION_RECOVERY.md** | docs/modules/session/SESSION_RECOVERY.md | ✅ DEFINIDO ESTRUTURA | v0.1-alpha | 2 |

> 📌 Dependências: MEMORY, CONTEXT, ROUTER

---

## BLOCO 2 — ROUTING ENGINE
> Responsável por: Classificação, Direcionamento, Prioridade, Fluxo

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **ROUTER.md** | docs/modules/routing/ROUTER.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |
| **ROUTE_DECISION_TREE.md** | docs/modules/routing/ROUTE_DECISION_TREE.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |
| **ROUTE_PRIORITY_MODEL.md** | docs/modules/routing/ROUTE_PRIORITY_MODEL.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |

> 📌 Dependências: SESSION, ORCHESTRATOR, SCORING

---

## BLOCO 3 — CONTEXT ENGINE
> Responsável por: Entendimento, Construção de Sentido, Fusão de Dados

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **CONTEXT_BUILDER.md** | docs/modules/context/CONTEXT_BUILDER.md | ⏳ PRÓXIMO A CRIAR | - | 2 |
| **CONTEXT_WINDOW_MODEL.md** | docs/modules/context/CONTEXT_WINDOW_MODEL.md | ⏳ A CRIAR | - | 2 |
| **CONTEXT_FUSION_LAYER.md** | docs/modules/context/CONTEXT_FUSION_LAYER.md | ⏳ A CRIAR | - | 2 |

> 📌 Dependências: SESSION, MEMORY, SCORING

---

## BLOCO 4 — SCORING SYSTEM
> Responsável por: Qualidade, Relevância, Confiança, Seleção

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **SCORING_ENGINE.md** | docs/modules/scoring/SCORING_ENGINE.md | ⏳ A CRIAR | - | 2 |
| **RELEVANCE_MODEL.md** | docs/modules/scoring/RELEVANCE_MODEL.md | ⏳ A CRIAR | - | 2 |
| **CONFIDENCE_RANKING.md** | docs/modules/scoring/CONFIDENCE_RANKING.md | ⏳ A CRIAR | - | 2 |

> 📌 Dependências: CONTEXT, MEMORY, ROUTER

---

## BLOCO 5 — ORCHESTRATION LAYER
> Responsável por: Cérebro Central, Fluxo Geral, Coordenação

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **ORCHESTRATOR_CORE.md** | docs/modules/orchestration/ORCHESTRATOR_CORE.md | ⏳ A CRIAR | - | 1 |
| **EXECUTION_GRAPH.md** | docs/modules/orchestration/EXECUTION_GRAPH.md | ⏳ A CRIAR | - | 1 |
| **FLOW_CONTROL.md** | docs/modules/orchestration/FLOW_CONTROL.md | ⏳ A CRIAR | - | 1 |
| **STATE_COORDINATION.md** | docs/modules/orchestration/STATE_COORDINATION.md | ⏳ A CRIAR | - | 1 |

> 📌 Dependências: TODOS OS OUTROS MÓDULOS

---

## BLOCO 6 — MEMORY EXPANSION
> Responsável por: Armazenamento Inteligente, Lembrar e Esquecer

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **MEMORY_ENGINE.md** | docs/modules/memory/MEMORY_ENGINE.md | ✅ CONCLUÍDO | v0.1-alpha | 2 |
| **MEMORY_COMPRESSION.md** | docs/modules/memory/MEMORY_COMPRESSION.md | ⏳ A CRIAR | - | 2 |
| **MEMORY_RECALL_STRATEGY.md** | docs/modules/memory/MEMORY_RECALL_STRATEGY.md | ⏳ A CRIAR | - | 2 |
| **MEMORY_PRIORITY_QUEUE.md** | docs/modules/memory/MEMORY_PRIORITY_QUEUE.md | ✅ DEFINIDO | v0.1-alpha | 2 |
| **MEMORY_CONFLICT_RESOLUTION.md** | docs/modules/memory/MEMORY_CONFLICT_RESOLUTION.md | ⏳ A CRIAR | - | 2 |

> 📌 Dependências: SESSION, CONTEXT, SCORING

---

## BLOCO 7 — SYSTEM INTEGRATION
> Responsável por: Início, Fim, Segurança, Estabilidade

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **SYSTEM_BOOTSTRAP.md** | docs/system/SYSTEM_BOOTSTRAP.md | ⏳ A CRIAR | - | 1 |
| **SYSTEM_OVERVIEW.md** | docs/system/SYSTEM_OVERVIEW.md | ⏳ A CRIAR | - | 0 |
| **FAILSAFE_PROTOCOL.md** | docs/system/FAILSAFE_PROTOCOL.md | ⏳ A CRIAR | - | 0 |
| **SAFE_MODE_SPEC.md** | docs/system/SAFE_MODE_SPEC.md | ⏳ A CRIAR | - | 0 |

---

## BLOCO 8 — API / ENGINE BRIDGE
> Responsável por: Conexão com JS, Dispositivos, Geladeira, Totens, Motores

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **API_INTERFACE_SPEC.md** | docs/bridge/API_INTERFACE_SPEC.md | ⏳ A CRIAR | - | 1 |
| **PROVIDER_ABSTRACTION_LAYER.md** | docs/bridge/PROVIDER_ABSTRACTION_LAYER.md | ⏳ A CRIAR | - | 1 |
| **CRS_INTEGRATION_SPEC.md** | docs/bridge/CRS_INTEGRATION_SPEC.md | ⏳ A CRIAR | - | 1 |

> 📌 **Aqui é onde o sistema fala com o mundo físico.**

---

## BLOCO 9 — OBSERVABILITY
> Responsável por: Ver o que acontece, Depurar, Auditoria

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **LOGGING_SYSTEM.md** | docs/observability/LOGGING_SYSTEM.md | ⏳ A CRIAR | - | 2 |
| **TRACE_ENGINE.md** | docs/observability/TRACE_ENGINE.md | ⏳ A CRIAR | - | 2 |
| **DEBUG_PROTOCOL.md** | docs/observability/DEBUG_PROTOCOL.md | ⏳ A CRIAR | - | 2 |

---

## BLOCO 10 — SECURITY / GOVERNANCE
> Responsável por: Regras, Limites, Segurança, Ética

| Arquivo | Caminho | Status | Versão | Autonomia |
|---|---|---|---|---|
| **GOVERNANCE_CORE.md** | docs/governance/GOVERNANCE_CORE.md | ⏳ A CRIAR | - | 0 |
| **RULE_ENFORCEMENT_LAYER.md** | docs/governance/RULE_ENFORCEMENT_LAYER.md | ⏳ A CRIAR | - | 0 |
| **EXECUTION_LIMITS.md** | docs/governance/EXECUTION_LIMITS.md | ⏳ A CRIAR | - | 0 |

---

# 🔗 MAPA DE DEPENDÊNCIAS GLOBAL

