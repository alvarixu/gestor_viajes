import { useState } from 'react';
import axios from 'axios';

const travelTypes = [
  { value: 'fiesta', label: 'Fiesta y vida nocturna' },
  { value: 'monumentos', label: 'Monumentos y cultura' },
  { value: 'escapada', label: 'Escapada mental' }
];

const seasons = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verano', label: 'Verano' },
  { value: 'otono', label: 'Otoño' },
  { value: 'invierno', label: 'Invierno' }
];

function App() {
  const [season, setSeason] = useState('verano');
  const [budget, setBudget] = useState('1500');
  const [travelType, setTravelType] = useState('monumentos');
  const [destination, setDestination] = useState(null);
  const [plan, setPlan] = useState(null);
  const [lodging, setLodging] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setDestination(null);
    setPlan(null);
    setLodging(null);

    try {
      const response = await axios.post('/api/travel', {
        season,
        budget,
        travelType
      });

      const { destination, plan, lodging } = response.data;
      setDestination(destination);
      setPlan(plan);
      setLodging(lodging);
      setChatHistory([
        { role: 'system', content: `Recomendación generada para destino: ${destination}.` }
      ]);
    } catch (err) {
      const message = err.response?.data?.error || 'No se pudo generar la propuesta. Revisa la configuración del servidor.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (event) => {
    event.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setChatInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        destination,
        plan,
        lodging,
        travelType,
        question: chatInput,
        history: newHistory
      });

      const assistantMessage = { role: 'assistant', content: response.data.answer };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError('No se pudo obtener respuesta del chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header>
        <h1>Gestor de Viajes IA</h1>
        <p>Planifica tu viaje con recomendaciones de destino, hospedaje y chat de soporte.</p>
      </header>

      <section className="form-card">
        <h2>Personaliza tu viaje</h2>
        <div className="grid">
          <label>
            Temporada
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Presupuesto (precio estimado)
            <input
              type="number"
              min="0"
              step="50"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Ej. 1200"
            />
          </label>

          <label>
            Enfoque del viaje
            <select value={travelType} onChange={(e) => setTravelType(e.target.value)}>
              {travelTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generando...' : 'Proponer destino y planificar'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {destination && (
        <section className="result-card">
          <h2>Destino recomendado</h2>
          <p className="highlight">{destination}</p>

          <div className="result-block">
            <h3>Plan de viaje</h3>
            <pre>{plan}</pre>
          </div>

          <div className="result-block">
            <h3>Hospedaje recomendado</h3>
            <p>{lodging}</p>
          </div>
        </section>
      )}

      {destination && (
        <section className="chat-card">
          <h2>Preguntas sobre tu plan</h2>
          <div className="chat-window">
            {chatHistory.map((message, index) => (
              <div key={index} className={`chat-message ${message.role}`}>
                <span className="role">{message.role === 'assistant' ? 'Asistente' : 'Tú'}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="chat-form">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Pregunta algo sobre el destino, hospedaje o plan..."
            />
            <button type="submit" disabled={loading}>Enviar</button>
          </form>
        </section>
      )}
    </div>
  );
}

export default App;
