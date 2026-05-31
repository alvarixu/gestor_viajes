import 'dotenv/config';
import axios from 'axios';

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchApiKey   = process.env.AZURE_SEARCH_API_KEY;
const searchIndex    = process.env.AZURE_SEARCH_INDEX;
const apiVersion     = '2023-11-01'; // Versión API REST de Azure Search

let indexReady = false;

// ─── Inicialización ───────────────────────────────────────────────────────────

export const ensureIndex = async () => {
  if (!searchEndpoint || !searchApiKey || !searchIndex) {
    console.warn('⚠️  Azure AI Search no configurado en .env. Historial y RAG desactivados.');
    return false;
  }
  try {
    const url = `${searchEndpoint}/indexes/${searchIndex}?api-version=${apiVersion}`;
    await axios.get(url, { headers: { 'api-key': searchApiKey } });
    indexReady = true;
    console.log(`✅ Índice '${searchIndex}' conectado en Azure AI Search`);
    return true;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`⚠️  Índice '${searchIndex}' no encontrado. Por favor créalo en Azure.`);
    } else {
      console.warn('⚠️  Error conectando a Azure AI Search:', err.message);
    }
    return false;
  }
};

const isReady = () => indexReady;

// ─── Operaciones CRUD en Azure Search ────────────────────────────────────────

export const indexTravelPlan = async ({
  id, destination, country, season, budget, travelType, days,
  why, planText, planJson, lodgingText, lodgingJson, imageUrl, embedding
}) => {
  if (!isReady()) return null;

  try {
    const document = {
      '@search.action': 'mergeOrUpload',
      id: String(id),
      destination: String(destination || ''),
      country: String(country || ''),
      season: String(season || ''),
      budget: String(budget || ''),
      travelType: String(travelType || ''),
      days: Number(days),
      why: String(why || ''),
      planText: String(planText || ''),
      planJson: String(planJson || '[]'),
      lodgingText: String(lodgingText || ''),
      lodgingJson: String(lodgingJson || '[]'),
      imageUrl: String(imageUrl || ''),
      chatHistory: '[]',
      createdAt: new Date().toISOString()
    };

    if (embedding && embedding.length > 0) {
      document.embedding = embedding;
    }

    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/index?api-version=${apiVersion}`;
    await axios.post(url, { value: [document] }, {
      headers: { 'Content-Type': 'application/json', 'api-key': searchApiKey }
    });
    return id;
  } catch (err) {
    console.error('Error indexando en Azure Search:', err.response?.data?.error?.message || err.message);
    return null;
  }
};

export const updatePlanChat = async (id, chatHistory) => {
  if (!isReady() || !id) return;
  try {
    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/index?api-version=${apiVersion}`;
    await axios.post(url, {
      value: [{ '@search.action': 'merge', id: String(id), chatHistory: JSON.stringify(chatHistory) }]
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': searchApiKey }
    });
  } catch (err) {
    console.error('Error actualizando chat en Azure Search:', err.message);
  }
};

export const getAllPlans = async () => {
  if (!isReady()) return [];
  try {
    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/search?api-version=${apiVersion}`;
    const response = await axios.post(url, {
      search: '*',
      select: 'id, destination, country, season, budget, travelType, days, why, planJson, lodgingJson, imageUrl, chatHistory, createdAt',
      orderby: 'createdAt desc',
      top: 50
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': searchApiKey }
    });
    return response.data?.value || [];
  } catch (err) {
    console.error('Error obteniendo historial:', err.message);
    return [];
  }
};

export const getPlan = async (id) => {
  if (!isReady()) return null;
  try {
    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/${id}?api-version=${apiVersion}`;
    const response = await axios.get(url, { headers: { 'api-key': searchApiKey } });
    return response.data;
  } catch (err) {
    console.error('Error obteniendo plan:', err.message);
    return null;
  }
};

// ─── Búsqueda Vectorial (RAG) ────────────────────────────────────────────────

export const searchSimilar = async (queryEmbedding, excludeId = null, topK = 3) => {
  if (!isReady() || !queryEmbedding) return [];
  try {
    const filter = excludeId ? `id ne '${excludeId}'` : null;
    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/search?api-version=${apiVersion}`;
    const response = await axios.post(url, {
      vectorQueries: [{
        kind: 'vector',
        vector: queryEmbedding,
        k: topK,
        fields: 'embedding'
      }],
      select: 'id, destination, country, season, travelType, days',
      ...(filter && { filter })
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': searchApiKey }
    });
    return response.data?.value || [];
  } catch (err) {
    console.error('Error en búsqueda vectorial:', err.response?.data?.error?.message || err.message);
    return [];
  }
};

export const searchRelevantContext = async (queryEmbedding, topK = 2) => {
  if (!isReady() || !queryEmbedding) return [];
  try {
    const url = `${searchEndpoint}/indexes/${searchIndex}/docs/search?api-version=${apiVersion}`;
    const response = await axios.post(url, {
      vectorQueries: [{
        kind: 'vector',
        vector: queryEmbedding,
        k: topK,
        fields: 'embedding'
      }],
      select: 'id, destination, chatHistory'
    }, {
      headers: { 'Content-Type': 'application/json', 'api-key': searchApiKey }
    });
    return response.data?.value || [];
  } catch (err) {
    console.error('Error en búsqueda de contexto:', err.message);
    return [];
  }
};
