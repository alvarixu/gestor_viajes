import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRAVEL_TYPES = [
  { value: 'fiesta', label: 'Fiesta y vida nocturna' },
  { value: 'monumentos', label: 'Monumentos y cultura' },
  { value: 'escapada', label: 'Escapada mental' },
  { value: 'naturaleza', label: 'Naturaleza y aventura' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'familiar', label: 'Viaje familiar' },
  { value: 'custom', label: 'Personalizado…' }
];

const SEASONS = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verano', label: 'Verano' },
  { value: 'otono', label: 'Otoño' },
  { value: 'invierno', label: 'Invierno' }
];

const REGIONS = [
  { value: 'cualquiera', label: 'Cualquier parte del mundo' },
  { value: 'europa', label: 'Europa' },
  { value: 'asia', label: 'Asia' },
  { value: 'america_norte', label: 'América del Norte' },
  { value: 'america_sur', label: 'América del Sur' },
  { value: 'america_centro', label: 'América Central y Caribe' },
  { value: 'africa', label: 'África' },
  { value: 'oceania', label: 'Oceanía' },
  { value: 'espana', label: 'Dentro de España' }
];

const DAY_PRESETS = [
  { days: 2, label: 'Fin de semana' },
  { days: 4, label: 'Escapada' },
  { days: 7, label: '1 Semana' },
  { days: 10, label: '10 Días' },
  { days: 14, label: '2 Semanas' }
];

const LOADING_STEPS = [
  { text: 'Analizando la temporada y tus preferencias...' },
  { text: 'Buscando 3 destinos únicos para ti...' },
  { text: 'Planificando cada día de los viajes...' },
  { text: 'Buscando el hospedaje ideal para cada destino...' }
];

const SEASON_LABELS = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno' };

const PROPOSAL_LABELS = [
  { label: 'Clásico', emoji: '⭐', desc: 'Popular y probado' },
  { label: 'Alternativo', emoji: '💎', desc: 'Joya oculta' },
  { label: 'Exótico', emoji: '🌏', desc: 'Fuera de lo común' }
];

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

// ─── Activity renderer ─────────────────────────────────────────────────────────

const ActivityItem = ({ act }) => {
  if (typeof act === 'string') {
    return <li><span className="act-name">{act}</span></li>;
  }
  return (
    <li className="act-item-rich">
      <div className="act-main">
        <span className="act-name">{act.name}</span>
        {act.price && (
          <span className={`act-price-badge ${act.price.toLowerCase().includes('gratis') ? 'free' : ''}`}>
            {act.price.toLowerCase().includes('gratis') ? '🆓 Gratis' : `💶 ${act.price}`}
          </span>
        )}
      </div>
      {act.description && <p className="act-description">{act.description}</p>}
      {act.url && (
        <a href={act.url} target="_blank" rel="noopener noreferrer" className="act-url">
          <span>🔗</span><span>Ver más</span>
        </a>
      )}
    </li>
  );
};

const LodgingCard = ({ lodging, index }) => {
  const getTier = (i) => {
    if (i <= 1) return { label: 'Económico', cls: 'tier-eco' };
    if (i <= 3) return { label: 'Estándar', cls: 'tier-std' };
    return { label: 'Premium', cls: 'tier-prem' };
  };
  const { label, cls } = getTier(index);
  return (
    <div className={`lodging-card lodging-option ${cls}`}>
      <div className="lodging-option-tier">{label}</div>
      <div className="lodging-header">
        <div>
          <div className="lodging-name">{lodging.name}</div>
          {lodging.type && <span className="lodging-type-badge">{lodging.type}</span>}
        </div>
        {lodging.price_range && <div className="lodging-price">{lodging.price_range}</div>}
      </div>
      {lodging.description && <p className="lodging-description">{lodging.description}</p>}
      {lodging.url && (
        <a href={lodging.url} target="_blank" rel="noopener noreferrer" className="lodging-url-btn">
          <span>🏨</span><span>Reservar</span><span className="lodging-url-arrow">→</span>
        </a>
      )}
    </div>
  );
};

const LodgingSection = ({ lodging }) => {
  if (!lodging) return null;
  const items = Array.isArray(lodging) ? lodging : [lodging];
  return (
    <div className="lodging-options-grid">
      {items.map((l, i) => <LodgingCard key={i} lodging={l} index={i} />)}
    </div>
  );
};


const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Component ────────────────────────────────────────────────────────────────

function App() {
  // Form state
  const [season, setSeason] = useState('verano');
  const [budget, setBudget] = useState('1500');
  const [travelType, setTravelType] = useState(['monumentos']);
  const [customType, setCustomType] = useState('');
  const [days, setDays] = useState(5);
  const [regions, setRegions] = useState(['cualquiera']);

  // Proposals modal state
  const [proposals, setProposals] = useState([]); // array of 3 results
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProposal, setActiveProposal] = useState(0); // 0,1,2
  const [selectedProposal, setSelectedProposal] = useState(null); // the chosen one
  const [imgErrors, setImgErrors] = useState({});

  // Chat state (per selected proposal)
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPlans, setHistoryPlans] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null); // 'Monumentos y cultura' etc.
  const [historyOriginGroup, setHistoryOriginGroup] = useState(null);

  const chatEndRef = useRef(null);
  const resultRef = useRef(null);
  const intervalRef = useRef(null);
  const modalRef = useRef(null);

  const [theme, setTheme] = useState('dark');

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Handle theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // Scroll to results when proposal is selected
  useEffect(() => {
    if (selectedProposal) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedProposal]);

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

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  // Load history when panel opens
  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen]);

  const toggleTravelType = (value) => {
    let newTypes = [...travelType];
    if (newTypes.includes(value)) {
      newTypes = newTypes.filter(t => t !== value);
      if (newTypes.length === 0) newTypes = ['monumentos'];
    } else {
      newTypes.push(value);
    }
    setTravelType(newTypes);
  };

  const effectiveTravelType = travelType.map(t => 
    t === 'custom' ? customType.trim() : TRAVEL_TYPES.find(tt => tt.value === t)?.label || t
  ).filter(t => t).join(' o ');

  const currentSeason = SEASONS.find(s => s.value === season);

  const toggleRegion = (value) => {
    if (value === 'cualquiera') {
      setRegions(['cualquiera']);
    } else {
      let newRegions = regions.filter(r => r !== 'cualquiera');
      if (newRegions.includes(value)) {
        newRegions = newRegions.filter(r => r !== value);
        if (newRegions.length === 0) newRegions = ['cualquiera'];
      } else {
        newRegions.push(value);
      }
      setRegions(newRegions);
    }
  };

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

  const loadPlanFromHistory = async (id, groupName = null) => {
    setPlanLoading(true);
    try {
      const { data } = await axios.get(`/api/plan/${id}`);
      if (!data) return;

      const restoredProposal = {
        planId: data.id,
        destination: data.destination,
        country: data.country,
        why: data.why,
        plan: JSON.parse(data.planJson || '[]'),
        lodging: JSON.parse(data.lodgingJson || '[]'),
        image: data.imageUrl
      };

      setProposals([restoredProposal]);
      setActiveProposal(0);
      setSelectedProposal(restoredProposal);
      setHistoryOriginGroup(groupName || selectedHistoryGroup); // save origin to go back
      setHistoryOpen(false); // close sidebar
      setSelectedHistoryGroup(null); // close previews modal
      setModalOpen(true);
      if (data.chatHistory) {
        setChatHistory(JSON.parse(data.chatHistory));
      } else {
        setChatHistory([]);
      }
    } catch (err) {
      console.error('Error cargando plan:', err.message);
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
    setProposals([]);
    setSelectedProposal(null);
    setModalOpen(false);
    setImgErrors({});
    setChatHistory([]);

    try {
      const selectedRegionLabels = regions.includes('cualquiera')
        ? 'Cualquier parte del mundo'
        : regions.map(v => REGIONS.find(r => r.value === v)?.label).join(' o ');

      const { data } = await axios.post('/api/travel', {
        season, budget, travelType: effectiveTravelType, days, region: selectedRegionLabels
      });
      setProposals(data.proposals || []);
      setActiveProposal(0);
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar la propuesta. Revisa la configuración del servidor.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Select a proposal ─────────────────────────────────────────────────────

  const handleSelectProposal = (proposal) => {
    setSelectedProposal(proposal);
    setChatHistory([]);
    setModalOpen(false);
  };

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedProposal) return;

    const userMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const { data } = await axios.post('/api/chat', {
        destination: selectedProposal?.destination,
        country: selectedProposal?.country,
        travelType: effectiveTravelType,
        days,
        plan: selectedProposal?.plan,
        lodging: selectedProposal?.lodging,
        question: chatInput,
        history: newHistory,
        planId: selectedProposal?.planId
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setError('No se pudo obtener respuesta del asistente.');
    } finally {
      setChatLoading(false);
    }
  };

  const visibleChat = chatHistory.filter(m => m.role !== 'system');

  // ─── Modal navigation ──────────────────────────────────────────────────────

  const goNext = () => setActiveProposal(p => (p + 1) % proposals.length);
  const goPrev = () => setActiveProposal(p => (p - 1 + proposals.length) % proposals.length);

  const currentProposal = proposals[activeProposal];

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

          {!historyLoading && historyPlans.length > 0 && (
            <div className="history-groups">
              {Object.entries(
                historyPlans.reduce((acc, plan) => {
                  const type = plan.travelType || 'Otros';
                  if (!acc[type]) acc[type] = [];
                  acc[type].push(plan);
                  return acc;
                }, {})
              ).map(([type, plans]) => (
                <button
                  key={type}
                  className="history-group-btn"
                  onClick={() => {
                    setSelectedHistoryGroup(type);
                    setHistoryOpen(false); // Hide sidebar when opening previews
                  }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '14px 18px', marginBottom: '8px',
                    background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{type}</span>
                  <span style={{
                    background: 'var(--accent-indigo)', color: 'white', padding: '2px 10px',
                    borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold'
                  }}>{plans.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── PREVIEWS MODAL (Polaroids) ────────────────────────────────────── */}
      {selectedHistoryGroup && (
        <>
          <div className="modal-backdrop" onClick={() => setSelectedHistoryGroup(null)} />
          <div className="previews-modal" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--bg-card)', padding: '30px', borderRadius: '16px',
            width: '90%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto',
            zIndex: 200, border: '1px solid var(--border-subtle)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Viajes guardados: <span style={{ color: 'var(--accent-indigo)' }}>{selectedHistoryGroup}</span></h2>
              <button className="history-close-btn" onClick={() => setSelectedHistoryGroup(null)}>✕</button>
            </div>
            
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px'
            }}>
              {historyPlans.filter(p => (p.travelType || 'Otros') === selectedHistoryGroup).map(plan => (
                <button
                  key={plan.id}
                  onClick={() => loadPlanFromHistory(plan.id, selectedHistoryGroup)}
                  disabled={planLoading}
                  style={{
                    background: 'white', padding: '10px 10px 20px', borderRadius: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
                    transition: 'transform 0.2s', textAlign: 'center', display: 'flex', flexDirection: 'column'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05) rotate(-2deg)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1) rotate(0)'}
                >
                  {plan.imageUrl ? (
                    <img src={plan.imageUrl} alt={plan.destination} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '2px', marginBottom: '12px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '160px', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', borderRadius: '2px', marginBottom: '12px' }}>🌍</div>
                  )}
                  <span style={{ color: '#333', fontWeight: 'bold', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>{plan.destination}</span>
                  <span style={{ color: '#777', fontSize: '0.85rem', marginTop: '4px' }}>{plan.days} días · {formatDate(plan.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── PROPOSALS MODAL ───────────────────────────────────────────────── */}
      {modalOpen && proposals.length > 0 && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)} />
          <div className="proposals-modal" role="dialog" aria-modal="true" aria-label="Propuestas de viaje" ref={modalRef}>

            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {historyOriginGroup && (
                  <button 
                    className="history-btn" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent' }}
                    onClick={() => {
                      setModalOpen(false);
                      setProposals([]);
                      setSelectedHistoryGroup(historyOriginGroup);
                      setHistoryOriginGroup(null);
                    }}
                  >
                    ⬅ Volver a {historyOriginGroup}
                  </button>
                )}
                <span className="modal-title-icon">✈️</span>
                <div>
                  <h2 className="modal-title">Tus 3 propuestas de viaje</h2>
                  <p className="modal-subtitle">{currentSeason?.label} · {budget}€ · {effectiveTravelType} · {days} {days === 1 ? 'día' : 'días'}</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</button>
            </div>

            {/* Proposal Tabs */}
            <div className="proposal-tabs">
              {proposals.map((p, i) => (
                <button
                  key={i}
                  className={`proposal-tab${activeProposal === i ? ' active' : ''}`}
                  onClick={() => setActiveProposal(i)}
                  id={`proposal-tab-${i}`}
                >
                  <span className="proposal-tab-emoji">{PROPOSAL_LABELS[i]?.emoji}</span>
                  <span className="proposal-tab-label">{PROPOSAL_LABELS[i]?.label}</span>
                  <span className="proposal-tab-dest">{p.destination}</span>
                </button>
              ))}
            </div>

            {/* Active Proposal Content */}
            {currentProposal && (
              <div className="modal-body">
                {/* Destination Hero */}
                <div className="modal-destination-hero">
                  {currentProposal.image && !imgErrors[activeProposal] ? (
                    <div className="modal-hero-img-wrap">
                      <img
                        src={currentProposal.image}
                        alt={currentProposal.destination}
                        className="modal-hero-img"
                        onError={() => setImgErrors(prev => ({ ...prev, [activeProposal]: true }))}
                      />
                      <div className="modal-hero-overlay" />
                      <div className="modal-hero-title">
                        <div className="proposal-type-pill">
                          <span>{PROPOSAL_LABELS[activeProposal]?.emoji}</span>
                          <span>{PROPOSAL_LABELS[activeProposal]?.label}</span>
                          <span className="proposal-type-desc">— {PROPOSAL_LABELS[activeProposal]?.desc}</span>
                        </div>
                        <h3 className="modal-dest-name">{currentProposal.destination}</h3>
                        {currentProposal.country && <span className="modal-dest-country">{currentProposal.country}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="modal-hero-no-img">
                      <div className="proposal-type-pill">
                        <span>{PROPOSAL_LABELS[activeProposal]?.emoji}</span>
                        <span>{PROPOSAL_LABELS[activeProposal]?.label}</span>
                        <span className="proposal-type-desc">— {PROPOSAL_LABELS[activeProposal]?.desc}</span>
                      </div>
                      <h3 className="modal-dest-name-plain">{currentProposal.destination}{currentProposal.country ? `, ${currentProposal.country}` : ''}</h3>
                    </div>
                  )}
                </div>

                {/* Why block */}
                {currentProposal.why && (
                  <div className="modal-why-block">
                    <div className="why-icon">💡</div>
                    <div>
                      <strong>¿Por qué este destino?</strong>
                      <p>{currentProposal.why}</p>
                    </div>
                  </div>
                )}

                {/* Plan preview */}
                {Array.isArray(currentProposal.plan) && currentProposal.plan.length > 0 && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">🗓️ Plan de viaje</h4>
                    <div className="modal-days-grid">
                      {currentProposal.plan.map((dayPlan) => (
                        <div className="modal-day-card" key={dayPlan.day}>
                          <div className="day-number">Día {dayPlan.day}</div>
                          <div className="day-title">{dayPlan.title}</div>
                          {Array.isArray(dayPlan.activities) && (
                            <ul className="activity-list rich">
                              {dayPlan.activities.map((act, i) => <ActivityItem key={i} act={act} />)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lodging */}
                {currentProposal.lodging && (
                  <div className="modal-section">
                    <h4 className="modal-section-title">🏨 3 opciones de hospedaje</h4>
                    <LodgingSection lodging={currentProposal.lodging} />
                  </div>
                )}

                {/* Navigation arrows + Select CTA */}
                <div className="modal-footer-actions">
                  <div className="modal-nav-arrows">
                    <button className="modal-nav-btn" onClick={goPrev} aria-label="Propuesta anterior">
                      ‹
                    </button>
                    <span className="modal-nav-counter">{activeProposal + 1} / {proposals.length}</span>
                    <button className="modal-nav-btn" onClick={goNext} aria-label="Propuesta siguiente">
                      ›
                    </button>
                  </div>
                  <button
                    className="btn-select-proposal"
                    onClick={() => handleSelectProposal(currentProposal)}
                    id={`select-proposal-${activeProposal}`}
                  >
                    <span>Elegir este destino</span>
                    <span className="btn-select-arrow">→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header>
        <div className="header-top">
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Cambiar tema" title="Cambiar tema">
              {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {proposals.length > 0 && !modalOpen && (
              <button
                className="reopen-modal-btn"
                onClick={() => setModalOpen(true)}
                id="reopen-modal-btn"
              >
                ✈️ Ver propuestas
              </button>
            )}
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
        </div>

        {/* Multi-selector de enfoques */}
        <div className="travel-types-section" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <span className="form-label" style={{ marginBottom: '12px', display: 'block' }}>Enfoque del viaje (Puedes marcar varios)</span>
          <div className="regions-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TRAVEL_TYPES.map(t => {
              const isActive = travelType.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  className={`day-preset-btn ${isActive ? 'active' : ''}`}
                  onClick={() => toggleTravelType(t.value)}
                  style={{ minWidth: 'auto', padding: '10px 16px' }}
                >
                  <span className="preset-label">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {travelType.includes('custom') && (
          <div className="form-group custom-input-group">
            <label className="form-label" htmlFor="custom-type-input">Describe tu tipo de viaje</label>
            <input
              id="custom-type-input" type="text" value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="Ej. luna de miel romántica, viaje fotográfico, turismo sostenible..."
            />
          </div>
        )}

        {/* Multi-selector de regiones */}
        <div className="regions-section" style={{ marginTop: '20px', marginBottom: '20px' }}>
          <span className="form-label" style={{ marginBottom: '12px', display: 'block' }}>¿A dónde te gustaría ir? (Puedes marcar varias)</span>
          <div className="regions-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {REGIONS.map(r => {
              const isActive = regions.includes(r.value);
              return (
                <button
                  key={r.value}
                  type="button"
                  className={`day-preset-btn ${isActive ? 'active' : ''}`}
                  onClick={() => toggleRegion(r.value)}
                  style={{ minWidth: 'auto', padding: '10px 16px' }}
                >
                  <span className="preset-label">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
            {loading ? 'Generando 3 propuestas...' : '✈️ Proponer 3 destinos'}
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

      {/* ── SELECTED RESULT ───────────────────────────────────────────────── */}
      {selectedProposal && (
        <section className="card card-delay-1" id="travel-results" ref={resultRef}>

          {/* Selected proposal header */}
          <div className="selected-proposal-header">
            <div className="selected-label">Tu destino elegido</div>
            <button
              className="change-proposal-btn"
              onClick={() => setModalOpen(true)}
              id="change-proposal-btn"
            >
              Cambiar destino
            </button>
          </div>

          {/* Imagen hero */}
          {selectedProposal.image && !imgErrors['selected'] ? (
            <div className="destination-image-wrapper">
              <img
                src={selectedProposal.image} alt={`${selectedProposal.destination}, ${selectedProposal.country}`}
                className="destination-image" onError={() => setImgErrors(prev => ({ ...prev, selected: true }))}
              />
              <div className="destination-image-overlay" />
              <div className="destination-image-title">
                <h2 className="destination-name-hero">{selectedProposal.destination}</h2>
                {selectedProposal.country && <span className="destination-country-hero">{selectedProposal.country}</span>}
              </div>
            </div>
          ) : (
            <div className="card-header">
              <div className="card-header-icon">📍</div>
              <h2>Destino recomendado</h2>
            </div>
          )}

          {(!selectedProposal.image || imgErrors['selected']) && (
            <p className="destination-highlight">
              {selectedProposal.destination}{selectedProposal.country ? `, ${selectedProposal.country}` : ''}
            </p>
          )}

          <div className="badges">
            <span className="badge badge-season">{currentSeason?.label}</span>
            <span className="badge badge-budget">{budget}€</span>
            <span className="badge badge-type">{effectiveTravelType}</span>
            <span className="badge badge-days">{days} {days === 1 ? 'día' : 'días'}</span>
            {selectedProposal.planId && <span className="badge badge-saved">Guardado</span>}
          </div>

          {selectedProposal.why && (
            <div className="why-block">
              <div className="why-icon">💡</div>
              <div>
                <strong>¿Por qué este destino?</strong>
                <p>{selectedProposal.why}</p>
              </div>
            </div>
          )}

          {/* Plan de días */}
          {Array.isArray(selectedProposal.plan) && selectedProposal.plan.length > 0 && (
            <div className="result-section">
              <h3>🗓️ Plan de viaje</h3>
              <div className="days-grid">
                {selectedProposal.plan.map((dayPlan) => (
                  <div className="day-card" key={dayPlan.day}>
                    <div className="day-number">Día {dayPlan.day}</div>
                    <div className="day-title">{dayPlan.title}</div>
                    {Array.isArray(dayPlan.activities) && (
                      <ul className="activity-list rich">
                        {dayPlan.activities.map((act, i) => <ActivityItem key={i} act={act} />)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hospedaje */}
          {selectedProposal.lodging && (
            <div className="result-section">
              <h3>🏨 Opciones de hospedaje</h3>
              <LodgingSection lodging={selectedProposal.lodging} />
            </div>
          )}

          {/* Viajes similares */}
          {selectedProposal.similarTrips?.length > 0 && (
            <div className="result-section similar-trips-section">
              <h3>Destinos similares que ya has explorado</h3>
              <div className="similar-trips-grid">
                {selectedProposal.similarTrips.map(trip => (
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
      {selectedProposal && (
        <section className="card card-delay-2" id="travel-chat">
          <div className="card-header">
            <div className="card-header-icon">💬</div>
            <h2>Preguntas sobre tu plan</h2>
            {selectedProposal.planId && <span className="chat-memory-badge">🧠 Con memoria</span>}
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
