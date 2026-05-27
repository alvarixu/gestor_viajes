import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRAVEL_TYPES = [
  { value: 'fiesta',      label: 'Fiesta y vida nocturna' },
  { value: 'monumentos',  label: 'Monumentos y cultura' },
  { value: 'escapada',    label: 'Escapada mental' },
  { value: 'naturaleza',  label: 'Naturaleza y aventura' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'familiar',    label: 'Viaje familiar' },
  { value: 'custom',      label: 'Personalizado…' }
];

const SEASONS = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verano',    label: 'Verano' },
  { value: 'otono',     label: 'Otoño' },
  { value: 'invierno',  label: 'Invierno' }
];

const DAY_PRESETS = [
  { days: 2,  label: 'Fin de semana' },
  { days: 4,  label: 'Escapada' },
  { days: 7,  label: '1 Semana' },
  { days: 10, label: '10 Días' },
  { days: 14, label: '2 Semanas' }
];

const LOADING_STEPS = [
  { text: 'Analizando la temporada y tus preferencias...' },
  { text: 'Buscando en tu historial de viajes...' },
  { text: 'Planificando cada día del viaje...' },
  { text: 'Buscando el hospedaje ideal...' }
];

const SEASON_LABELS = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno' };

// ─── Markdown renderer ────────────────────────────────────────────────────────

const renderMarkdown = (text) => {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  const styleLine = (line) =>
    line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

  for (const line of lines) {
    const isListItem = /^[\-\*] /.test(line);
    if (isListItem) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${styleLine(line.replace(/^[\-\*] /, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim() === '') {
        html += '<br/>';
      } else {
        html += `<span class="md-line">${styleLine(line)}</span><br/>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const typeEmoji = (travelType) =>
  TRAVEL_TYPES.find(t => t.label === travelType || t.value === travelType)?.emoji || '✏️';

// ─── Component ────────────────────────────────────────────────────────────────

function App() {
  // Form state
  const [season, setSeason]           = useState('verano');
  const [budget, setBudget]           = useState('1500');
  const [travelType, setTravelType]   = useState('monumentos');
  const [customType, setCustomType]   = useState('');
  const [days, setDays]               = useState(5);

  // Result state
  const [result, setResult]           = useState(null);
  const [planId, setPlanId]           = useState(null);
  const [similarTrips, setSimilarTrips] = useState([]);
  const [imgError, setImgError]       = useState(false);

  // Chat state
  const [chatInput, setChatInput]     = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Loading state
  const [loading, setLoading]         = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError]             = useState('');

  // History panel
  const [historyOpen, setHistoryOpen]       = useState(false);
  const [historyPlans, setHistoryPlans]     = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [planLoading, setPlanLoading]       = useState(false);

  const chatEndRef  = useRef(null);
  const resultRef   = useRef(null);
  const intervalRef = useRef(null);

  const [theme, setTheme]             = useState('dark');

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Handle theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  // Scroll to results
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  // Loading step animation
  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      intervalRef.current = setInterval(() => setLoadingStep(p => (p + 1) % LOADING_STEPS.length), 1800);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [loading]);

  // Load history when panel opens
  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen]);

  const effectiveTravelType =
    travelType === 'custom'
      ? customType.trim()
      : TRAVEL_TYPES.find(t => t.value === travelType)?.label || travelType;

  const currentSeason = SEASONS.find(s => s.value === season);
  const currentType   = TRAVEL_TYPES.find(t => t.value === travelType);

  // ─── History ───────────────────────────────────────────────────────────────

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await axios.get('/api/history');
      setHistoryPlans(data || []);
    } catch {
      // silently fail if RAG not configured
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPlanFromHistory = async (id) => {
    setPlanLoading(true);
    try {
      const { data } = await axios.get(`/api/plan/${id}`);
      if (!data) return;

      // Restore result state
      setResult({
        destination: data.destination,
        country:     data.country,
        why:         data.why,
        plan:        JSON.parse(data.planJson  || '[]'),
        lodging:     JSON.parse(data.lodgingJson || '{}'),
        image:       data.imageUrl || null
      });
      setPlanId(data.id);
      setSimilarTrips([]);
      setImgError(false);

      // Restore chat
      const savedChat = JSON.parse(data.chatHistory || '[]');
      setChatHistory(savedChat);

      setHistoryOpen(false);
    } catch {
      setError('No se pudo cargar el viaje guardado.');
    } finally {
      setPlanLoading(false);
    }
  };

  // ─── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (travelType === 'custom' && !customType.trim()) {
      setError('Por favor, describe tu tipo de viaje personalizado.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setPlanId(null);
    setSimilarTrips([]);
    setImgError(false);

    try {
      const { data } = await axios.post('/api/travel', {
        season, budget, travelType: effectiveTravelType, days
      });
      setResult(data);
      setPlanId(data.planId || null);
      setSimilarTrips(data.similarTrips || []);
      setChatHistory([]);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar la propuesta. Revisa la configuración del servidor.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg    = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const { data } = await axios.post('/api/chat', {
        destination: result?.destination,
        country:     result?.country,
        travelType:  effectiveTravelType,
        days,
        plan:        result?.plan,
        lodging:     result?.lodging,
        question:    chatInput,
        history:     newHistory,
        planId
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setError('No se pudo obtener respuesta del asistente.');
    } finally {
      setChatLoading(false);
    }
  };

  const visibleChat = chatHistory.filter(m => m.role !== 'system');

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">

      {/* ── HISTORY PANEL ────────────────────────────────────────────────── */}
      {historyOpen && (
        <div className="history-overlay" onClick={() => setHistoryOpen(false)} />
      )}
      <aside className={`history-panel${historyOpen ? ' open' : ''}`} aria-label="Historial de viajes">
        <div className="history-panel-header">
          <div className="history-panel-title">
            <span>Mis viajes</span>
          </div>
          <button className="history-close-btn" onClick={() => setHistoryOpen(false)} aria-label="Cerrar historial">✕</button>
        </div>

        <div className="history-panel-body">
          {historyLoading && (
            <div className="history-loading">
              <span className="spinner" style={{ borderTopColor: 'var(--accent-indigo)' }} />
              <span>Cargando historial…</span>
            </div>
          )}

          {!historyLoading && historyPlans.length === 0 && (
            <div className="history-empty">
              <span>Aún no tienes viajes guardados. ¡Genera tu primero!</span>
            </div>
          )}

          {!historyLoading && historyPlans.map(plan => (
            <button
              key={plan.id}
              className={`history-item${plan.id === planId ? ' active' : ''}`}
              onClick={() => loadPlanFromHistory(plan.id)}
              disabled={planLoading}
            >
              {plan.imageUrl ? (
                <img src={plan.imageUrl} alt={plan.destination} className="history-item-img" />
              ) : (
                <div className="history-item-img history-item-img-placeholder"></div>
              )}
              <div className="history-item-info">
                <div className="history-item-dest">{plan.destination}</div>
                <div className="history-item-meta">
                  <span>{plan.travelType}</span>
                  <span>📅 {plan.days}d</span>
                </div>
                <div className="history-item-date">{formatDate(plan.createdAt)}</div>
              </div>
              {plan.id === planId && <div className="history-item-active-dot" />}
            </button>
          ))}
        </div>
      </aside>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header>
        <div className="header-top">
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Cambiar tema" title="Cambiar tema">
              {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="history-btn"
              onClick={() => setHistoryOpen(true)}
              aria-label="Ver mis viajes"
              id="history-btn"
            >
              Mis viajes
            </button>
          </div>
        </div>
        <h1>Gestor de Viajes IA</h1>
        <p className="subtitle">
          Planifica tu viaje ideal con recomendaciones inteligentes de destino, hospedaje y un asistente personal.
        </p>
      </header>

      {/* ── FORMULARIO ───────────────────────────────────────────────────── */}
      <section className="card" id="travel-form">
        <div className="card-header">
          <h2>Personaliza tu viaje</h2>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="season-select">Temporada</label>
            <select id="season-select" value={season} onChange={e => setSeason(e.target.value)}>
              {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="budget-input">Presupuesto total</label>
            <div className="budget-wrapper">
              <input
                id="budget-input" type="number" min="0" step="50"
                value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ej. 1200"
              />
              <span className="currency-symbol">€</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="type-select">Enfoque del viaje</label>
            <select id="type-select" value={travelType} onChange={e => setTravelType(e.target.value)}>
              {TRAVEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {travelType === 'custom' && (
          <div className="form-group custom-input-group">
            <label className="form-label" htmlFor="custom-type-input">Describe tu tipo de viaje</label>
            <input
              id="custom-type-input" type="text" value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="Ej. luna de miel romántica, viaje fotográfico, turismo sostenible..."
            />
          </div>
        )}

        {/* Selector de días */}
        <div className="days-section">
          <span className="form-label">Duración del viaje</span>
          <div className="days-presets">
            {DAY_PRESETS.map(p => (
              <button
                key={p.days} type="button"
                className={`day-preset-btn${days === p.days ? ' active' : ''}`}
                onClick={() => setDays(p.days)}
              >
                <span className="preset-label">{p.label}</span>
                <span className="preset-days">{p.days}d</span>
              </button>
            ))}
          </div>
          <div className="days-custom">
            <span className="days-custom-label">O elige exactamente:</span>
            <div className="days-stepper">
              <button type="button" className="stepper-btn" onClick={() => setDays(d => Math.max(1, d - 1))} aria-label="Reducir días">−</button>
              <span className="days-value">{days} {days === 1 ? 'día' : 'días'}</span>
              <button type="button" className="stepper-btn" onClick={() => setDays(d => Math.min(30, d + 1))} aria-label="Aumentar días">+</button>
            </div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleGenerate} disabled={loading} id="generate-btn">
          <span>
            {loading && <span className="spinner" />}
            {loading ? 'Generando tu viaje...' : 'Proponer destino y planificar'}
          </span>
        </button>

        {loading && (
          <div className="loading-steps">
            <span className="loading-step-text">{LOADING_STEPS[loadingStep].text}</span>
          </div>
        )}

        {error && (
          <div className="error-message"><span>⚠️</span><span>{error}</span></div>
        )}
      </section>

      {/* ── RESULTADOS ───────────────────────────────────────────────────── */}
      {result && (
        <section className="card card-delay-1" id="travel-results" ref={resultRef}>

          {/* Imagen hero */}
          {result.image && !imgError ? (
            <div className="destination-image-wrapper">
              <img
                src={result.image} alt={`${result.destination}, ${result.country}`}
                className="destination-image" onError={() => setImgError(true)}
              />
              <div className="destination-image-overlay" />
              <div className="destination-image-title">
                <h2 className="destination-name-hero">{result.destination}</h2>
                {result.country && <span className="destination-country-hero">{result.country}</span>}
              </div>
            </div>
          ) : (
            <div className="card-header">
              <div className="card-header-icon">📍</div>
              <h2>Destino recomendado</h2>
            </div>
          )}

          {(!result.image || imgError) && (
            <p className="destination-highlight">
              {result.destination}{result.country ? `, ${result.country}` : ''}
            </p>
          )}

          <div className="badges">
            <span className="badge badge-season">{currentSeason?.label}</span>
            <span className="badge badge-budget">{budget}€</span>
            <span className="badge badge-type">{effectiveTravelType}</span>
            <span className="badge badge-days">{days} {days === 1 ? 'día' : 'días'}</span>
            {planId && <span className="badge badge-saved">Guardado</span>}
          </div>

          {result.why && (
            <div className="why-block">
              <div className="why-icon">💡</div>
              <div>
                <strong>¿Por qué este destino?</strong>
                <p>{result.why}</p>
              </div>
            </div>
          )}

          {/* Plan de días */}
          {Array.isArray(result.plan) && result.plan.length > 0 && (
            <div className="result-section">
              <h3>🗓️ Plan de viaje</h3>
              <div className="days-grid">
                {result.plan.map((dayPlan) => (
                  <div className="day-card" key={dayPlan.day}>
                    <div className="day-number">Día {dayPlan.day}</div>
                    <div className="day-title">{dayPlan.title}</div>
                    {Array.isArray(dayPlan.activities) && (
                      <ul className="activity-list">
                        {dayPlan.activities.map((act, i) => <li key={i}>{act}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hospedaje */}
          {result.lodging && (
            <div className="result-section">
              <h3>🏨 Hospedaje recomendado</h3>
              <div className="lodging-card">
                <div className="lodging-header">
                  <div>
                    <div className="lodging-name">{result.lodging.name}</div>
                    {result.lodging.type && <span className="lodging-type-badge">{result.lodging.type}</span>}
                  </div>
                  {result.lodging.price_range && <div className="lodging-price">{result.lodging.price_range}</div>}
                </div>
                {result.lodging.description && <p className="lodging-description">{result.lodging.description}</p>}
              </div>
            </div>
          )}

          {/* ── Viajes similares (RAG) ────────────────────────────────────── */}
          {similarTrips.length > 0 && (
            <div className="result-section similar-trips-section">
              <h3>Destinos similares que ya has explorado</h3>
              <div className="similar-trips-grid">
                {similarTrips.map(trip => (
                  <button
                    key={trip.id}
                    className="similar-trip-card"
                    onClick={() => loadPlanFromHistory(trip.id)}
                    disabled={planLoading}
                  >
                    {trip.imageUrl ? (
                      <img src={trip.imageUrl} alt={trip.destination} className="similar-trip-img" />
                    ) : (
                      <div className="similar-trip-img similar-trip-img-placeholder">🌍</div>
                    )}
                    <div className="similar-trip-info">
                      <div className="similar-trip-dest">{trip.destination}</div>
                      <div className="similar-trip-meta">
                        <span>{trip.travelType}</span>
                        <span>{SEASON_LABELS[trip.season] || trip.season}</span>
                      </div>
                      <div className="similar-trip-date">{formatDate(trip.createdAt)}</div>
                    </div>
                    <div className="similar-trip-action">Ver viaje →</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── CHAT ─────────────────────────────────────────────────────────── */}
      {result && (
        <section className="card card-delay-2" id="travel-chat">
          <div className="card-header">
            <div className="card-header-icon">💬</div>
            <h2>Preguntas sobre tu plan</h2>
            {planId && <span className="chat-memory-badge">🧠 Con memoria</span>}
          </div>

          <div className="chat-window">
            {visibleChat.length === 0 && !chatLoading && (
              <div className="chat-empty">
                <span className="chat-empty-icon">💬</span>
                <span>Haz una pregunta sobre tu destino, hospedaje o plan de viaje</span>
              </div>
            )}

            {visibleChat.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.role}`}>
                <div className="chat-avatar">{msg.role === 'assistant' ? '🤖' : '👤'}</div>
                <div className="chat-content">
                  {msg.role === 'assistant'
                    ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    : msg.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="typing-indicator">
                <div className="chat-avatar assistant-avatar">🤖</div>
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="chat-form">
            <input
              id="chat-input" type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Pregunta sobre el destino, hospedaje o plan..."
            />
            <button
              type="submit" className="btn-send"
              disabled={chatLoading || !chatInput.trim()} id="chat-send-btn" aria-label="Enviar"
            >➤</button>
          </form>
        </section>
      )}

      <footer>
        <div className="footer-divider" />
        <p>Gestor de Viajes IA · Impulsado por inteligencia artificial</p>
      </footer>
    </div>
  );
}

export default App;
