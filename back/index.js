import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { generateEmbedding, buildTravelText, buildQueryText } from './services/embeddings.js';
import {
  ensureIndex, indexTravelPlan, updatePlanChat,
  getAllPlans, getPlan, searchSimilar, searchRelevantContext
} from './services/azureSearch.js';

dotenv.config();

const app  = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Inicializar índice de Azure AI Search al arrancar
ensureIndex();

// ─── Configuración Azure AI Foundry ──────────────────────────────────────────

const foundryEndpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
const foundryApiKey   = process.env.AZURE_FOUNDRY_API_KEY;
const foundryModel    = process.env.AZURE_FOUNDRY_MODEL;
const unsplashKey     = process.env.UNSPLASH_ACCESS_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const callAI = async (messages, maxTokens = 1800) => {
  const response = await axios.post(
    foundryEndpoint,
    { model: foundryModel, messages, max_tokens: maxTokens, temperature: 0.85 },
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${foundryApiKey}` } }
  );
  return extractText(response.data);
};

const extractText = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (Array.isArray(data.output)) {
    return data.output
      .map(item => {
        if (typeof item === 'string') return item;
        if (typeof item.text === 'string') return item.text;
        if (Array.isArray(item.content)) return item.content.map(b => b?.text || b?.value || '').join(' ');
        return '';
      })
      .filter(Boolean).join('\n');
  }
  return data.result || '';
};

const parseJSON = (text) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned);
};

const getDestinationImage = async (destination, country) => {
  if (!unsplashKey) return null;
  try {
    const { data } = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query: `${destination} ${country} travel`, orientation: 'landscape', client_id: unsplashKey },
      timeout: 5000
    });
    return data?.urls?.regular || null;
  } catch { return null; }
};

const serializePlan = (plan) =>
  Array.isArray(plan)
    ? plan.map(d => `Día ${d.day} - ${d.title}: ${(d.activities || []).join(', ')}`).join(' | ')
    : String(plan || '');

const serializeLodging = (lodging) =>
  lodging ? `${lodging.name} (${lodging.type}): ${lodging.description} - ${lodging.price_range || ''}` : '';

// ─── POST /api/travel ─────────────────────────────────────────────────────────

app.post('/api/travel', async (req, res) => {
  const { season, budget, travelType, days = 4 } = req.body;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  // 1. Generar embedding de la consulta y buscar contexto RAG
  const queryText     = buildQueryText({ season, travelType, days, budget });
  const queryEmbedding = await generateEmbedding(queryText);
  const ragContext    = queryEmbedding ? await searchSimilar(queryEmbedding, null, 2) : [];

  // 2. Construir contexto RAG para el prompt
  let ragSection = '';
  if (ragContext.length > 0) {
    ragSection = `\n\nCONTEXTO — viajes similares ya planificados anteriormente (para inspirarte y proponer algo diferente pero igualmente bueno):\n${ragContext
      .map(r => `- ${r.destination}, ${r.country} (${r.travelType}, ${r.season}, ${r.days} días)`)
      .join('\n')}`;
  }

  // 3. Prompts
  const systemPrompt = `Eres un experto planificador de viajes. Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después, sin bloques de código markdown.

El JSON debe seguir exactamente esta estructura:
{
  "destination": "nombre de la ciudad",
  "country": "nombre del país",
  "why": "párrafo de 2-3 frases explicando por qué este destino es perfecto para las condiciones indicadas",
  "plan": [
    {
      "day": 1,
      "title": "título temático y evocador del día",
      "activities": ["actividad detallada 1", "actividad detallada 2", "actividad detallada 3"]
    }
  ],
  "lodging": {
    "name": "nombre del alojamiento o tipo específico recomendado",
    "type": "tipo exacto (hotel boutique / hostel / apartamento turístico / resort / glamping / etc.)",
    "description": "descripción de 2 frases del alojamiento y por qué encaja perfectamente con el enfoque del viaje",
    "price_range": "rango de precio estimado por noche en euros (ej. 60-90€/noche)"
  }
}`;

  const userPrompt = `Propón el destino ideal para este viaje:
- Temporada: ${season}
- Presupuesto total: ${budget} euros
- Enfoque del viaje: ${travelType}
- Duración: ${days} días${ragSection}

Genera el plan completo con exactamente ${days} días. Cada día debe tener entre 3 y 4 actividades específicas.`;

  try {
    const text = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    let travelData;
    try {
      travelData = parseJSON(text);
    } catch {
      travelData = {
        destination: 'Destino recomendado', country: '', why: text,
        plan: [{ day: 1, title: 'Plan', activities: [text] }],
        lodging: { name: 'Hospedaje sugerido', type: '', description: text, price_range: '' }
      };
    }

    // 4. Obtener imagen y generar embedding del resultado en paralelo
    const planText    = serializePlan(travelData.plan);
    const lodgingText = serializeLodging(travelData.lodging);
    const fullText    = buildTravelText({
      ...travelData, season, budget, travelType, days, planText, lodgingText
    });

    const [image, planEmbedding] = await Promise.all([
      getDestinationImage(travelData.destination, travelData.country),
      generateEmbedding(fullText)
    ]);

    // 5. Indexar el plan en Azure AI Search
    const planId = crypto.randomUUID();
    await indexTravelPlan({
      id:          planId,
      destination: travelData.destination,
      country:     travelData.country,
      season, budget: String(budget), travelType, days: Number(days),
      why:         travelData.why || '',
      planText,
      planJson:    JSON.stringify(travelData.plan),
      lodgingText,
      lodgingJson: JSON.stringify(travelData.lodging),
      imageUrl:    image || '',
      embedding:   planEmbedding
    });

    // 6. Buscar viajes similares para mostrar en el UI (usando el embedding del plan generado)
    const similarTrips = planEmbedding
      ? await searchSimilar(planEmbedding, planId, 3)
      : [];

    res.json({ ...travelData, image, planId, similarTrips });

  } catch (error) {
    console.error(error.message || error);
    res.status(500).json({ error: 'Error al llamar a Azure Foundry' });
  }
});

// ─── POST /api/chat ───────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { destination, country, travelType, days, plan, lodging, question, history, planId } = req.body;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  // Buscar contexto relevante de chats pasados (RAG del chat)
  const questionEmbedding  = await generateEmbedding(question);
  const relevantPastChats  = questionEmbedding
    ? await searchRelevantContext(questionEmbedding, 2)
    : [];

  // Construir sección de memoria de chats pasados
  let pastChatContext = '';
  if (relevantPastChats.length > 0) {
    const chatSnippets = relevantPastChats
      .filter(r => r.id !== planId)
      .map(r => {
        const chatArr = JSON.parse(r.chatHistory || '[]');
        const relevant = chatArr.filter(m => m.role !== 'system').slice(-4);
        if (relevant.length === 0) return null;
        return `[Viaje a ${r.destination}]: ${relevant.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join(' | ')}`;
      })
      .filter(Boolean);
    if (chatSnippets.length > 0) {
      pastChatContext = `\n\nCONTEXTO DE CHATS ANTERIORES (para referencia):\n${chatSnippets.join('\n')}`;
    }
  }

  const planSummary = Array.isArray(plan)
    ? plan.map(d => `Día ${d.day} - ${d.title}: ${(d.activities || []).join(', ')}`).join('\n')
    : String(plan || '');

  const systemPrompt = `Eres un asistente de viajes experto y amigable. El usuario tiene planificado el siguiente viaje:

DESTINO: ${destination}${country ? `, ${country}` : ''}
ENFOQUE: ${travelType}
DURACIÓN: ${days} días

PLAN DÍA A DÍA:
${planSummary}

ALOJAMIENTO: ${lodging?.name || ''} (${lodging?.type || ''}) — ${lodging?.description || ''} — ${lodging?.price_range || ''}${pastChatContext}

Responde de forma clara y útil. Usa **negritas**, listas con guiones y párrafos separados cuando sea apropiado.`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.filter(m => m.role !== 'system') : [])
    ];

    const answer = await callAI(messages, 900);

    // Guardar chat actualizado en Azure AI Search (fire-and-forget)
    if (planId) {
      const updatedHistory = [
        ...(Array.isArray(history) ? history.filter(m => m.role !== 'system') : []),
        { role: 'assistant', content: answer }
      ];
      updatePlanChat(planId, updatedHistory).catch(() => {});
    }

    res.json({ answer: answer || 'No hay respuesta disponible.' });

  } catch (error) {
    console.error(error.message || error);
    res.status(500).json({ error: 'Error al consultar el chat de Azure Foundry' });
  }
});

// ─── GET /api/history ─────────────────────────────────────────────────────────

app.get('/api/history', async (_req, res) => {
  try {
    const plans = await getAllPlans();
    res.json(plans);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// ─── GET /api/plan/:id ────────────────────────────────────────────────────────

app.get('/api/plan/:id', async (req, res) => {
  try {
    const plan = await getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(plan);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Error obteniendo plan' });
  }
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`✈️  Gestor de Viajes IA en http://localhost:${port}`);
});
