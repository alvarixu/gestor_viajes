import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const travelTypes = [
  { value: 'fiesta', label: 'Fiesta y vida nocturna', emoji: '🎉' },
  { value: 'monumentos', label: 'Monumentos y cultura', emoji: '🏛️' },
  { value: 'escapada', label: 'Escapada mental', emoji: '🧘' }
];

const seasons = [
  { value: 'primavera', label: 'Primavera', emoji: '🌸' },
  { value: 'verano', label: 'Verano', emoji: '☀️' },
  { value: 'otono', label: 'Otoño', emoji: '🍂' },
  { value: 'invierno', label: 'Invierno', emoji: '❄️' }
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
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatLoading]);

  useEffect(() => {
    if (destination && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [destination]);

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
      setChatHistory([]);
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
    setChatLoading(true);

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
      setChatLoading(false);
    }
  };

  const getSeasonEmoji = () => seasons.find(s => s.value === season)?.emoji || '';
  const getTypeEmoji = () => travelTypes.find(t => t.value === travelType)?.emoji || '';
  const getSeasonLabel = () => seasons.find(s => s.value === season)?.label || '';
  const getTypeLabel = () => travelTypes.find(t => t.value === travelType)?.label || '';

  const visibleChat = chatHistory.filter(m => m.role !== 'system');

  return (
    <div className="page-container">
      <header>
        <span className="header-icon" role="img" aria-label="avión">✈️</span>
        <h1>Gestor de Viajes IA</h1>
        <p className="subtitle">
          Planifica tu viaje ideal con recomendaciones inteligentes de destino, hospedaje y un asistente personal.
        </p>
      </header>

      {/* ─── FORMULARIO ─── */}
      <section className="card" id="travel-form">
        <div className="card-header">
          <div className="card-header-icon">🗺️</div>
          <h2>Personaliza tu viaje</h2>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="season-select">Temporada</label>
            <select
              id="season-select"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              {seasons.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.emoji} {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="budget-input">Presupuesto</label>
            <div className="budget-wrapper">
              <input
                id="budget-input"
                type="number"
                min="0"
                step="50"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Ej. 1200"
              />
              <span className="currency-symbol">€</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="type-select">Enfoque del viaje</label>
            <select
              id="type-select"
              value={travelType}
              onChange={(e) => setTravelType(e.target.value)}
            >
              {travelTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.emoji} {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={loading}
          id="generate-btn"
        >
          <span>
            {loading && <span className="spinner" />}
            {loading ? 'Generando tu viaje...' : '✨ Proponer destino y planificar'}
          </span>
        </button>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* ─── RESULTADOS ─── */}
      {destination && (
        <section className="card card-delay-1" id="travel-results" ref={resultRef}>
          <div className="card-header">
            <div className="card-header-icon">📍</div>
            <h2>Destino recomendado</h2>
          </div>

          <p className="destination-highlight">{destination}</p>

          <div className="badges">
            <span className="badge badge-season">{getSeasonEmoji()} {getSeasonLabel()}</span>
            <span className="badge badge-budget">💰 {budget}€</span>
            <span className="badge badge-type">{getTypeEmoji()} {getTypeLabel()}</span>
          </div>

          <div className="result-section">
            <h3>🗓️ Plan de viaje</h3>
            <p className="result-text">{plan}</p>
          </div>

          <div className="result-section">
            <h3>🏨 Hospedaje recomendado</h3>
            <p className="result-text">{lodging}</p>
          </div>
        </section>
      )}

      {/* ─── CHAT ─── */}
      {destination && (
        <section className="card card-delay-2" id="travel-chat">
          <div className="card-header">
            <div className="card-header-icon">💬</div>
            <h2>Preguntas sobre tu plan</h2>
          </div>

          <div className="chat-window">
            {visibleChat.length === 0 && !chatLoading && (
              <div className="chat-empty">
                <span className="chat-empty-icon">💬</span>
                <span>Haz una pregunta sobre tu destino, hospedaje o plan de viaje</span>
              </div>
            )}

            {visibleChat.map((message, index) => (
              <div key={index} className={`chat-bubble ${message.role}`}>
                <div className="chat-avatar">
                  {message.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className="chat-content">
                  {message.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="typing-indicator">
                <div className="chat-avatar" style={{background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'}}>🤖</div>
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="chat-form">
            <input
              id="chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Pregunta sobre el destino, hospedaje o plan..."
            />
            <button
              type="submit"
              className="btn-send"
              disabled={chatLoading || !chatInput.trim()}
              id="chat-send-btn"
            >
              ➤
            </button>
          </form>
        </section>
      )}

      {/* ─── FOOTER ─── */}
      <footer>
        <div className="footer-divider" />
        <p>Gestor de Viajes IA · Impulsado por inteligencia artificial</p>
      </footer>
    </div>
  );
}

export default App;
