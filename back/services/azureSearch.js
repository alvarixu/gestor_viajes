import 'dotenv/config';
import axios from 'axios';

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchKey      = process.env.AZURE_SEARCH_API_KEY;
const indexName      = process.env.AZURE_SEARCH_INDEX || 'travel-plans';
const API_VER        = '2024-07-01';

const isConfigured = () => !!(searchEndpoint && searchKey);

const headers = () => ({
  'Content-Type': 'application/json',
  'api-key': searchKey
});

const indexUrl = () => `${searchEndpoint}/indexes/${indexName}?api-version=${API_VER}`;
const docsUrl  = () => `${searchEndpoint}/indexes/${indexName}/docs`;

// ─── Definición del índice ────────────────────────────────────────────────────

const INDEX_DEF = {
  name: indexName,
  fields: [
    { name: 'id',          type: 'Edm.String',              key: true, filterable: true },
    { name: 'destination', type: 'Edm.String', searchable: true, filterable: true },
    { name: 'country',     type: 'Edm.String', searchable: true, filterable: true },
    { name: 'season',      type: 'Edm.String', filterable: true },
    { name: 'budget',      type: 'Edm.String' },
    { name: 'travelType',  type: 'Edm.String', filterable: true },
    { name: 'days',        type: 'Edm.Int32' },
    { name: 'why',         type: 'Edm.String', searchable: true },
    { name: 'planText',    type: 'Edm.String', searchable: true },    // texto legible para búsqueda
    { name: 'planJson',    type: 'Edm.String' },                      // JSON completo para restaurar
    { name: 'lodgingText', type: 'Edm.String', searchable: true },    // texto legible
    { name: 'lodgingJson', type: 'Edm.String' },                      // JSON completo para restaurar
    { name: 'chatHistory', type: 'Edm.String' },                      // JSON del historial de chat
    { name: 'imageUrl',    type: 'Edm.String' },
    { name: 'createdAt',   type: 'Edm.DateTimeOffset', sortable: true, filterable: true },
    {
      name: 'embedding',
      type: 'Collection(Edm.Single)',
      dimensions: 1536,
      vectorSearchProfile: 'hnswProfile'
    }
  ],
  vectorSearch: {
    algorithms: [{
      name: 'hnswAlgo',
      kind: 'hnsw',
      hnswParameters: { m: 4, efConstruction: 400, efSearch: 500, metric: 'cosine' }
    }],
    profiles: [{ name: 'hnswProfile', algorithm: 'hnswAlgo' }]
  }
};

// ─── Inicialización ───────────────────────────────────────────────────────────

export const ensureIndex = async () => {
  if (!isConfigured()) {
    console.warn('⚠️  Azure AI Search no configurado — historial y RAG desactivados.');
    return false;
  }

  try {
    await axios.get(indexUrl(), { headers: headers() });
    console.log(`✅ Índice '${indexName}' conectado en Azure AI Search`);
    return true;
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error('Error comprobando índice:', err.message);
      return false;
    }
    // El índice no existe → crearlo
    try {
      await axios.put(indexUrl(), INDEX_DEF, { headers: headers() });
      console.log(`✅ Índice '${indexName}' creado en Azure AI Search`);
      return true;
    } catch (createErr) {
      console.error('Error creando índice:', createErr.response?.data || createErr.message);
      return false;
    }
  }
};

// ─── Operaciones CRUD ─────────────────────────────────────────────────────────

export const indexTravelPlan = async ({
  id, destination, country, season, budget, travelType, days,
  why, planText, planJson, lodgingText, lodgingJson, imageUrl, embedding
}) => {
  if (!isConfigured()) return null;

  const doc = {
    '@search.action': 'mergeOrUpload',
    id,
    destination,
    country,
    season,
    budget:      String(budget),
    travelType,
    days:        Number(days),
    why:         why || '',
    planText:    planText || '',
    planJson:    planJson || '[]',
    lodgingText: lodgingText || '',
    lodgingJson: lodgingJson || '{}',
    imageUrl:    imageUrl || '',
    chatHistory: '[]',
    createdAt:   new Date().toISOString(),
    ...(embedding ? { embedding } : {})
  };

  try {
    await axios.post(
      `${docsUrl()}/index?api-version=${API_VER}`,
      { value: [doc] },
      { headers: headers() }
    );
    return id;
  } catch (err) {
    console.error('Error indexando plan:', err.response?.data || err.message);
    return null;
  }
};

export const updatePlanChat = async (id, chatHistory) => {
  if (!isConfigured() || !id) return;
  try {
    await axios.post(
      `${docsUrl()}/index?api-version=${API_VER}`,
      { value: [{ '@search.action': 'merge', id, chatHistory: JSON.stringify(chatHistory) }] },
      { headers: headers() }
    );
  } catch (err) {
    console.error('Error guardando chat:', err.message);
  }
};

export const getAllPlans = async () => {
  if (!isConfigured()) return [];
  try {
    const { data } = await axios.post(
      `${docsUrl()}/search?api-version=${API_VER}`,
      {
        search: '*',
        select: 'id,destination,country,season,budget,travelType,days,why,imageUrl,createdAt',
        orderby: 'createdAt desc',
        top: 50
      },
      { headers: headers() }
    );
    return data?.value || [];
  } catch (err) {
    console.error('Error obteniendo historial:', err.message);
    return [];
  }
};

export const getPlan = async (id) => {
  if (!isConfigured()) return null;
  try {
    const { data } = await axios.get(
      `${docsUrl()}/${encodeURIComponent(id)}?api-version=${API_VER}`,
      { headers: headers() }
    );
    return data;
  } catch (err) {
    console.error('Error obteniendo plan:', err.message);
    return null;
  }
};

// ─── Búsqueda vectorial ───────────────────────────────────────────────────────

export const searchSimilar = async (queryEmbedding, excludeId = null, topK = 3) => {
  if (!isConfigured() || !queryEmbedding) return [];
  try {
    const { data } = await axios.post(
      `${docsUrl()}/search?api-version=${API_VER}`,
      {
        select: 'id,destination,country,season,budget,travelType,days,why,imageUrl,createdAt',
        top: topK + (excludeId ? 1 : 0),
        vectorQueries: [{
          kind: 'vector',
          vector: queryEmbedding,
          fields: 'embedding',
          k: topK + (excludeId ? 1 : 0),
          exhaustive: true
        }]
      },
      { headers: headers() }
    );
    return (data?.value || [])
      .filter(r => r.id !== excludeId)
      .slice(0, topK);
  } catch (err) {
    console.error('Error buscando similares:', err.response?.data || err.message);
    return [];
  }
};

export const searchRelevantContext = async (queryEmbedding, topK = 2) => {
  if (!isConfigured() || !queryEmbedding) return [];
  try {
    const { data } = await axios.post(
      `${docsUrl()}/search?api-version=${API_VER}`,
      {
        select: 'id,destination,country,travelType,why,planText,chatHistory',
        top: topK,
        vectorQueries: [{
          kind: 'vector',
          vector: queryEmbedding,
          fields: 'embedding',
          k: topK,
          exhaustive: true
        }]
      },
      { headers: headers() }
    );
    return data?.value || [];
  } catch (err) {
    console.error('Error buscando contexto:', err.message);
    return [];
  }
};
