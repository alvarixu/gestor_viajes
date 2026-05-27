import axios from 'axios';

const embeddingEndpoint = process.env.AZURE_EMBEDDING_ENDPOINT;
const embeddingApiKey   = process.env.AZURE_EMBEDDING_API_KEY;
const embeddingModel    = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';

/**
 * Genera un vector de 1536 dimensiones con text-embedding-ada-002.
 * Compatible con Azure AI Foundry y Azure OpenAI.
 * Devuelve null si el embedding no está configurado (funcionalidad degradada sin RAG).
 */
export const generateEmbedding = async (text) => {
  if (!embeddingEndpoint || !embeddingApiKey) return null;

  try {
    const response = await axios.post(
      embeddingEndpoint,
      { model: embeddingModel, input: String(text).slice(0, 8000) },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${embeddingApiKey}`
        },
        timeout: 8000
      }
    );
    return response.data?.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error('Error generando embedding:', err.message);
    return null;
  }
};

/**
 * Construye el texto representativo de un viaje para embeddings.
 * Concatena todos los campos relevantes para capturar la semántica completa.
 */
export const buildTravelText = ({ destination, country, season, travelType, days, budget, why, planText, lodgingText }) =>
  `${destination} ${country} ${travelType} ${season} ${days} días ${budget}€. ${why || ''} ${planText || ''} ${lodgingText || ''}`.trim();

/**
 * Construye el texto de consulta del usuario (antes de generar el plan).
 * Captura la intención de búsqueda para la similitud vectorial.
 */
export const buildQueryText = ({ season, travelType, days, budget }) =>
  `Viaje ${travelType} en ${season}, ${days} días, presupuesto ${budget}€`;
