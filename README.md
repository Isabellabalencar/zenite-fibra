# Zênite Fibra – Landing page com chat de suporte via RAG

Projeto acadêmico: landing page de uma provedora de internet **fictícia** com um chat de suporte. Cada pergunta do visitante é enviada para um **webhook do n8n**, que responde usando **RAG** (Retrieval-Augmented Generation) sobre a documentação oficial de suporte da empresa.

```
Visitante ──► Landing page (GitHub Pages)
                 │  POST { sessionId, mensagem }
                 ▼
             Webhook n8n ──► AI Agent (Gemini)
                                │  ferramenta: base_de_conhecimento
                                ▼
                         Supabase (pgvector) ◄── ingestão do PDF do Google Drive
                 ◄──────── { resposta }
```

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `index.html`, `assets/` | Landing page + widget de chat (HTML, CSS e JS puros) |
| `assets/js/config.js` | **URL do webhook do n8n** (único arquivo a editar) |
| `documentacao/` | Base de conhecimento fictícia (`.md` e `.pdf` para subir no Drive) |
| `supabase/setup.sql` | Cria a tabela `suporte_zenite` e a função `match_suporte_zenite` |
| `n8n/zenite-suporte-rag.json` | Workflow do n8n (ingestão + chat via webhook) |

## Passo a passo

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole `supabase/setup.sql` e clique em **Run**.
3. Anote a **Project URL** e a chave **service_role** (Project Settings → API).

### 2. Google Drive
Suba `documentacao/base-de-conhecimento-zenite.pdf` no seu Drive e copie o **ID do arquivo** (o trecho entre `/d/` e `/view` no link).

### 3. n8n
1. **Workflows → Import from File** → `n8n/zenite-suporte-rag.json`.
2. Configure as credenciais: Google Drive, Supabase (URL + service_role), OpenAI (embeddings) e Google Gemini (chat).
3. No nó **Baixar PDF do Drive**, cole o ID do arquivo.
4. Rode a ingestão: clique em **Execute workflow** no nó **Iniciar Ingestão**. Confira as linhas em `suporte_zenite` no Supabase.
5. **Ative o workflow** (toggle *Active*) e copie a **Production URL** do nó **Webhook**.

### 4. Landing page
1. Cole a URL em `assets/js/config.js`:
   ```js
   window.ZENITE_CONFIG = {
     webhookUrl: "https://SEU-N8N/webhook/zenite-suporte",
     timeoutMs: 60000
   };
   ```
2. Faça commit e push. O GitHub Pages publica a nova versão em ~1 minuto.

## Contrato do webhook

**Requisição** (`POST`, `Content-Type: application/json`):
```json
{ "sessionId": "uuid-do-visitante", "mensagem": "Como pego a 2ª via do boleto?" }
```

**Resposta**:
```json
{ "resposta": "Você pode emitir a segunda via pelo app Minha Zênite..." }
```

O `sessionId` é gerado no navegador e guardado no `localStorage`; o n8n usa esse valor para manter a memória da conversa de cada visitante.

## Testar o webhook sem o site

```bash
curl -X POST "https://SEU-N8N/webhook/zenite-suporte" -H "Content-Type: application/json" -d "{\"sessionId\":\"teste\",\"mensagem\":\"Quais são os planos?\"}"
```

## Observações
- O n8n precisa estar acessível pela internet (n8n Cloud ou self-hosted com domínio/HTTPS). Um n8n em `localhost` não é alcançado pela página publicada.
- O webhook aceita requisições de qualquer origem (`Allowed Origins: *`). Para restringir, troque pelo domínio do GitHub Pages no nó Webhook.
- A URL do webhook fica visível no código do site, como em qualquer chat público.

---
*Zênite Fibra é uma empresa fictícia. Planos, preços, telefones e e-mails são inventados para fins acadêmicos.*
