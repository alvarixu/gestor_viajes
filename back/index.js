import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { generateEmbedding, buildTravelText, buildQueryText } from './services/embeddings.js';
import {
  ensureIndex, indexTravelPlan, updatePlanChat,
  getAllPlans, getPlan, searchSimilar, searchRelevantContext
} from './services/azureSearch.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Inicializar índice de Azure AI Search al arrancar
ensureIndex();

// ─── Configuración Azure AI Foundry ──────────────────────────────────────────

const foundryEndpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
const foundryApiKey = process.env.AZURE_FOUNDRY_API_KEY;
const foundryModel = process.env.AZURE_FOUNDRY_MODEL;
const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getChatEndpoint = () => {
  if (foundryEndpoint.includes('/chat/completions')) return foundryEndpoint;
  if (foundryEndpoint.includes('.openai.azure.com')) {
    // Es un endpoint base de Azure OpenAI
    const base = foundryEndpoint.replace(/\/openai\/v1\/?$/, '').replace(/\/$/, '');
    return `${base}/openai/deployments/${foundryModel}/chat/completions?api-version=2024-02-15-preview`;
  }
  // Fallback asumiendo Foundry Serverless
  return `${foundryEndpoint.replace(/\/$/, '')}/models/chat/completions?api-version=2024-02-15-preview`;
};

const callAI = async (messages, maxTokens = 5000) => {
  const url = getChatEndpoint();
  const response = await axios.post(
    url,
    { model: foundryModel, messages, max_tokens: maxTokens, temperature: 0.85 },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${foundryApiKey}`,
        'api-key': foundryApiKey // Soporte Azure OpenAI directo
      }
    }
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
    ? plan.map(d => {
      const acts = (d.activities || []).map(a =>
        typeof a === 'string' ? a : `${a.name} (${a.price || 'precio variable'})`
      ).join(', ');
      return `Día ${d.day} - ${d.title}: ${acts}`;
    }).join(' | ')
    : String(plan || '');

const serializeLodging = (lodging) => {
  if (!lodging) return '';
  if (Array.isArray(lodging)) {
    return lodging.map(l => `${l.name} (${l.type}): ${l.description} — ${l.price_range || ''}`).join(' | ');
  }
  return `${lodging.name} (${lodging.type}): ${lodging.description} - ${lodging.price_range || ''}`;
};

// Normaliza la respuesta de la IA para garantizar estructura correcta
const normalizeTravelData = (data) => {
  if (!data || typeof data !== 'object') return data;

  // Normalizar lodging → siempre array
  if (data.lodging && !Array.isArray(data.lodging)) {
    data.lodging = [data.lodging];
  }
  if (!Array.isArray(data.lodging)) data.lodging = [];

  // Normalizar activities → siempre array de objetos
  if (Array.isArray(data.plan)) {
    data.plan = data.plan.map(day => ({
      ...day,
      activities: (day.activities || []).map(act => {
        if (typeof act === 'string') {
          return { name: act, description: '', price: '', url: '' };
        }
        return {
          name: act.name || act.activity || act.title || '',
          description: act.description || '',
          price: act.price || act.cost || act.precio || '',
          url: act.url || act.website || act.link || ''
        };
      })
    }));
  }

  // Normalizar cada lodging
  data.lodging = data.lodging.map((l, i) => ({
    name: l.name || l.hotel || `Opción ${i + 1}`,
    type: l.type || l.tipo || '',
    description: l.description || l.descripcion || '',
    price_range: l.price_range || l.precio || l.price || '',
    url: l.url || l.website || l.link || l.booking_url || ''
  }));

  return data;
};

// ─── POST /api/travel ─────────────────────────────────────────────────────────

app.post('/api/travel', async (req, res) => {
  const { season, budget, travelType, days = 4, region = 'cualquiera' } = req.body;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  // 1. Generar embedding de la consulta y buscar contexto RAG
  const queryText = buildQueryText({ season, travelType, days, budget });
  const queryEmbedding = await generateEmbedding(queryText);
  const ragContext = queryEmbedding ? await searchSimilar(queryEmbedding, null, 3) : [];

  // 2. Construir contexto RAG para el prompt
  let ragSection = '';
  if (ragContext.length > 0) {
    ragSection = `\n\nCONTEXTO — viajes similares ya planificados anteriormente (propón destinos DIFERENTES a estos):\n${ragContext
      .map(r => `- ${r.destination}, ${r.country} (${r.travelType}, ${r.season}, ${r.days} días)`)
      .join('\n')}`;
  }

  // 3. Sistema de prompt base
  const systemPrompt = `Eres un experto planificador de viajes. DEBES responder EXCLUSIVAMENTE con un objeto JSON válido y completo. CERO texto fuera del JSON. CERO bloques de código. CERO explicaciones.

El campo "lodging" DEBE ser un ARRAY con EXACTAMENTE 6 objetos de alojamiento (2 económicos, 2 estándar y 2 premium).
El campo "activities" de cada día DEBE ser un ARRAY de objetos, NO de strings.

Estructura JSON OBLIGATORIA (copia este formato exactamente):

{
  "destination": "Barcelona",
  "country": "España",
  "why": "Barcelona es ideal en verano por sus playas y oferta cultural...",
  "plan": [
    {
      "day": 1,
      "title": "Arte y arquitectura modernista",
      "activities": [
        {
          "name": "Sagrada Família",
          "description": "La obra maestra inacabada de Gaudí, catedral modernista única en el mundo.",
          "price": "26€/persona",
          "url": "https://sagradafamilia.org/es/entradas"
        },
        {
          "name": "Casa Batlló",
          "description": "Edificio modernista de Gaudí con entrada interactiva y vistas a Paseo de Gracia.",
          "price": "35€/persona",
          "url": "https://www.casabatllo.es/es/entradas/"
        },
        {
          "name": "Paseo de Gracia",
          "description": "El bulevar más elegante de Barcelona lleno de arquitectura modernista.",
          "price": "Gratis",
          "url": "https://www.barcelona.cat"
        }
      ]
    }
  ],
  "lodging": [
    {
      "name": "Generator Barcelona",
      "type": "Hostel boutique",
      "description": "Hostel de diseño en el barrio del Raval, ideal para viajeros con presupuesto ajustado.",
      "price_range": "25-45€/noche",
      "url": "https://www.booking.com/hotel/es/generator-barcelona.es.html"
    },
    {
      "name": "Barcelo Raval",
      "type": "Hotel 4 estrellas",
      "description": "Hotel moderno con piscina en la azotea y vistas panorámicas de Barcelona.",
      "price_range": "120-180€/noche",
      "url": "https://www.booking.com/hotel/es/barcelo-raval.es.html"
    },
    {
      "name": "Hotel Arts Barcelona",
      "type": "Hotel de lujo 5 estrellas",
      "description": "Hotel de lujo en la playa con vistas al mar y restaurante estrella Michelin.",
      "price_range": "350-600€/noche",
      "url": "https://www.booking.com/hotel/es/arts-barcelona.es.html"
    },
    {
      "name": "Feelathome Eixample Apartments",
      "type": "Apartamento turístico",
      "description": "Apartamentos modernos en el Eixample, con cocina completa y ambiente local.",
      "price_range": "60-90€/noche",
      "url": "https://www.airbnb.es/rooms/barcelona"
    },
    {
      "name": "Hotel Praktik Rambla",
      "type": "Hotel 3 estrellas",
      "description": "Hotel boutique en plena Rambla con diseño cuidado y excelente ubicación.",
      "price_range": "90-130€/noche",
      "url": "https://www.booking.com/hotel/es/praktikrambla.es.html"
    },
    {
      "name": "W Barcelona",
      "type": "Resort de lujo",
      "description": "Icónico rascacielos junto al mar con spa, piscina infinita y ambiente exclusivo.",
      "price_range": "280-500€/noche",
      "url": "https://www.booking.com/hotel/es/w-barcelona.es.html"
    }
  ]
}

REGLAS ABSOLUTAS:
1. "lodging" SIEMPRE es un ARRAY de 6 elementos. NUNCA un objeto.
2. "activities" de cada día SIEMPRE son ARRAY de objetos con name/description/price/url. NUNCA strings.
3. Todos los campos "url" deben ser URLs reales que empiecen con https://.
4. El precio de actividades debe ser en euros por persona (ej: "12€/persona" o "Gratis").
5. El campo "why" máximo 3 frases.`;

  const regionText = (region && region !== 'cualquiera' && region !== 'Cualquier parte del mundo') 
    ? `\n- Región: ${region}` 
    : '';
  
  const promptVariants = [
    `Propón el destino IDEAL (opción clásica y más popular) para este viaje:\n- Temporada: ${season}\n- Presupuesto total: ${budget} euros\n- Enfoque del viaje: ${travelType}\n- Duración: ${days} días${regionText}${ragSection}\n\nGenera el plan completo con exactamente ${days} días. Cada día debe tener entre 3 y 4 actividades específicas.`,
    `Propón un destino ALTERNATIVO Y SORPRENDENTE (menos convencional, joya oculta o destino emergente) para este viaje:\n- Temporada: ${season}\n- Presupuesto total: ${budget} euros\n- Enfoque del viaje: ${travelType}\n- Duración: ${days} días${regionText}${ragSection}\n\nGenera el plan completo con exactamente ${days} días. Cada día debe tener entre 3 y 4 actividades específicas. Elige un destino diferente al primero que propondrías normalmente.`,
    `Propón un destino EXÓTICO Y AVENTURERO (fuera de lo común, que pocos visitantes conocen) para este viaje:\n- Temporada: ${season}\n- Presupuesto total: ${budget} euros\n- Enfoque del viaje: ${travelType}\n- Duración: ${days} días${regionText}${ragSection}\n\nGenera el plan completo con exactamente ${days} días. Cada día debe tener entre 3 y 4 actividades específicas. Propón algo muy diferente a un destino europeo clásico.`
  ];

  try {
    // 5. Generar las 3 propuestas en paralelo
    const aiResults = await Promise.all(
      promptVariants.map(userPrompt =>
        callAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], 5000).then(text => {
          try {
            const parsed = parseJSON(text);
            return normalizeTravelData(parsed);
          } catch {
            return normalizeTravelData({
              destination: 'Destino recomendado', country: '', why: text,
              plan: [{ day: 1, title: 'Plan', activities: [{ name: text, description: '', price: '', url: '' }] }],
              lodging: []
            });
          }
        })
      )
    );

    // 6. Para cada propuesta: obtener imagen + embedding + indexar, en paralelo
    const proposals = await Promise.all(
      aiResults.map(async (travelData) => {
        const planText = serializePlan(travelData.plan);
        const lodgingText = serializeLodging(travelData.lodging);
        const fullText = buildTravelText({
          ...travelData, season, budget, travelType, days, planText, lodgingText
        });

        const [image, planEmbedding] = await Promise.all([
          getDestinationImage(travelData.destination, travelData.country),
          generateEmbedding(fullText)
        ]);

        const planId = crypto.randomUUID();
        await indexTravelPlan({
          id: planId,
          destination: travelData.destination,
          country: travelData.country,
          season, budget: String(budget), travelType, days: Number(days),
          why: travelData.why || '',
          planText,
          planJson: JSON.stringify(travelData.plan),
          lodgingText,
          lodgingJson: JSON.stringify(travelData.lodging),
          imageUrl: image || '',
          embedding: planEmbedding
        });

        const similarTrips = planEmbedding
          ? await searchSimilar(planEmbedding, planId, 2)
          : [];

        return { ...travelData, image, planId, similarTrips };
      })
    );

    res.json({ proposals });

  } catch (err) {
    console.error('Error generando viaje:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error al llamar a Azure Foundry', details: err.response?.data || err.message });
  }
});

// ─── POST /api/chat ───────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { destination, country, travelType, days, plan, lodging, question, history, planId } = req.body;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  // Buscar contexto relevante de chats pasados (RAG del chat)
  const questionEmbedding = await generateEmbedding(question);
  const relevantPastChats = questionEmbedding
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

    // Actualizar historial de chat en Azure AI Search
    if (planId) {
      const updatedHistory = [
        ...(Array.isArray(history) ? history.filter(m => m.role !== 'system') : []),
        { role: 'assistant', content: answer }
      ];
      updatePlanChat(planId, updatedHistory).catch(() => { });
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
