import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const foundryEndpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
const foundryApiKey = process.env.AZURE_FOUNDRY_API_KEY;
const foundryModel = process.env.AZURE_FOUNDRY_MODEL;

const buildRequestBody = ({ messages }) => ({
  model: foundryModel,
  messages,
  max_tokens: 600,
  temperature: 0.85
});

const extractResponseText = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (Array.isArray(data.output)) {
    return data.output
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item.text === 'string') return item.text;
        if (Array.isArray(item.content)) {
          return item.content.map((block) => block?.text || block?.value || '').join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return data.result || '';
};

app.post('/api/travel', async (req, res) => {
  const { season, budget, travelType } = req.body;
  const prompt = `Eres un asistente de viajes. Propón un destino ideal para la temporada ${season}, con un presupuesto aproximado de ${budget} euros y enfoque ${travelType}. Incluye plan de 4 días y sugiere hospedaje adecuado para ese enfoque.`;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  try {
    const body = buildRequestBody({ messages: [{ role: 'system', content: prompt }] });
    const response = await axios.post(foundryEndpoint, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${foundryApiKey}`
      }
    });

    const text = extractResponseText(response.data);
    const [destinationMatch, planMatch, lodgingMatch] = text
      .split('\n\n')
      .map((part) => part.trim());

    res.json({
      destination: destinationMatch || 'Destino recomendado',
      plan: planMatch || text,
      lodging: lodgingMatch || 'Hospedaje sugerido según enfoque'
    });
  } catch (error) {
    console.error(error.message || error);
    res.status(500).json({ error: 'Error al llamar a Azure Foundry' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { destination, plan, lodging, travelType, question, history } = req.body;
  const prompt = `Eres un asistente de viajes. El usuario va a viajar a ${destination} con enfoque ${travelType}. Ya se ha generado este plan: ${plan}. Hospedaje recomendado: ${lodging}. Responde la pregunta de forma clara y útil: ${question}`;

  if (!foundryEndpoint || !foundryApiKey || !foundryModel) {
    return res.status(500).json({ error: 'Falta configuración de Azure Foundry en .env' });
  }

  try {
    const messages = [
      { role: 'system', content: prompt },
      ...(Array.isArray(history) ? history : [])
    ];
    const body = buildRequestBody({ messages });
    const response = await axios.post(foundryEndpoint, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${foundryApiKey}`
      }
    });

    const answer = extractResponseText(response.data) || 'No hay respuesta disponible.';
    res.json({ answer });
  } catch (error) {
    console.error(error.message || error);
    res.status(500).json({ error: 'Error al consultar el chat de Azure Foundry' });
  }
});

app.listen(port, () => {
  console.log(`Servidor de Gestor de Viajes IA en http://localhost:${port}`);
});
