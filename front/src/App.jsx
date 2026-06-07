import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon path issue with Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

// ─── Activity renderer ───────────────────────────────────────────────────────────

// ─── Restaurant Stars helper ─────────────────────────────────────────────────────────

const StarRating = ({ score, max = 5 }) => {
  const pct = Math.min(1, score / max) * 100;
  return (
    <span className="star-rating" title={`${score.toFixed(1)} / ${max}`}>
      <span className="stars-empty">★★★★★</span>
      <span className="stars-filled" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
};

// ─── Restaurant Card ───────────────────────────────────────────────────────────────────

const TYPE_EMOJI = {
  restaurant: '🍽️', cafe: '☕', bar: '🍺', pub: '🍻',
  bistro: '🥘', fast_food: '🍔', default: '🍽️'
};

const RestaurantCard = ({ r }) => {
  const emoji = TYPE_EMOJI[r.type] || TYPE_EMOJI.default;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + (r.address ? ' ' + r.address : ''))}&query_place_id=${r.lat},${r.lng}`;
  const cuisine = r.cuisine ? r.cuisine.replace(/_/g, ' ').replace(/;/g, ', ') : '';
  return (
    <div className="restaurant-card">
      <div className="restaurant-card-header">
        <span className="restaurant-emoji">{emoji}</span>
        <div className="restaurant-info">
          <div className="restaurant-name">{r.name}</div>
          {cuisine && <div className="restaurant-cuisine">{cuisine}</div>}
        </div>
        {r.stars > 0 && (
          <div className="restaurant-rating">
            <StarRating score={r.stars} />
            <span className="restaurant-score">{r.stars.toFixed(1)}</span>
          </div>
        )}
      </div>
      {r.address && <div className="restaurant-address">📍 {r.address}</div>}
      {r.opening_hours && (
        <div className="restaurant-hours">
          ⏰ <span>{r.opening_hours.split(';')[0]}</span>
        </div>
      )}
      <div className="restaurant-actions">
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="restaurant-maps-btn">
          Ver en Maps →
        </a>
        {r.website && (
          <a href={r.website} target="_blank" rel="noopener noreferrer" className="restaurant-web-btn">
            Web
          </a>
        )}
      </div>
    </div>
  );
};

// ─── DayMap component ───────────────────────────────────────────────────────────────────

// Custom numbered marker for activities
const createNumberedIcon = (num) =>
  L.divIcon({
    className: '',
    html: `<div class="map-marker-num">${num}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

// Restaurant marker
const restaurantIcon = L.divIcon({
  className: '',
  html: `<div class="map-marker-restaurant">🍽️</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const DayMap = ({ activities, restaurants, destination }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef    = useRef(null);
  const layerGroupRef     = useRef(null);

  // Initialise map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [40.4168, -3.7038], zoom: 13,
      zoomControl: true, scrollWheelZoom: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current  = L.layerGroup().addTo(map);
    // CRITICAL: force Leaflet to recalculate size once the container is visible in DOM
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Also invalidate size whenever activities change (tab switch may hide/show the container)
  useEffect(() => {
    const timer = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
    return () => clearTimeout(timer);
  }, [activities]);

  // Update markers & route when activities/restaurants change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const lg  = layerGroupRef.current;
    if (!map || !lg) return;
    lg.clearLayers();

    const validActs = (activities || []).filter(a => a._lat && a._lng);
    const validRest = (restaurants  || []).filter(r => r.lat  && r.lng);

    // Activity markers
    validActs.forEach((act, i) => {
      const marker = L.marker([act._lat, act._lng], { icon: createNumberedIcon(i + 1) })
        .bindPopup(`<strong>${i + 1}. ${act.name}</strong>${act.price ? `<br><span class='map-popup-price'>${act.price}</span>` : ''}`);
      lg.addLayer(marker);
    });

    // Restaurant markers
    validRest.forEach(r => {
      const marker = L.marker([r.lat, r.lng], { icon: restaurantIcon })
        .bindPopup(`<strong>🍽️ ${r.name}</strong>${r.cuisine ? `<br>${r.cuisine.replace(/_/g,' ')}` : ''}${r.stars > 0 ? `<br>★ ${r.stars.toFixed(1)}` : ''}`);
      lg.addLayer(marker);
    });

    // Route polyline between activity markers
    if (validActs.length >= 2) {
      const latlngs = validActs.map(a => [a._lat, a._lng]);
      const line = L.polyline(latlngs, {
        color: '#818cf8', weight: 3, opacity: 0.85,
        dashArray: '8 6', lineCap: 'round', lineJoin: 'round'
      });
      lg.addLayer(line);
      // Fit bounds to all features
      const allPoints = [
        ...latlngs,
        ...validRest.map(r => [r.lat, r.lng])
      ];
      map.fitBounds(L.latLngBounds(allPoints).pad(0.15));
    } else if (validActs.length === 1) {
      map.setView([validActs[0]._lat, validActs[0]._lng], 14);
    }
  }, [activities, restaurants]);

  return (
    <div className="day-map-wrapper">
      <div ref={mapContainerRef} className="day-map-container" />
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot legend-activity">1</span> Actividad</span>
        <span className="legend-item"><span className="legend-rest">🍽️</span> Restaurante</span>
        <span className="legend-item"><span className="legend-line" /> Ruta</span>
      </div>
    </div>
  );
};

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
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
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
  const [savedPlans, setSavedPlans] = useState(() => { try { return JSON.parse(localStorage.getItem('vIAja_saved_plans') || '[]'); } catch { return []; } });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null);
  const [historyOriginGroup, setHistoryOriginGroup] = useState(null);

  // Map & restaurants state
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [geoActivities, setGeoActivities] = useState([]); // activities with _lat/_lng
  const [dayRestaurants, setDayRestaurants] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [minRating, setMinRating] = useState(0); // 0 = todos

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
    if (activeTab === 'history' || activeTab === 'all_history') loadHistory();
  }, [activeTab]);

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
      setActiveTab('proposals');
      if (window.innerWidth <= 768) setSidebarExpanded(false);
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
      setActiveTab('proposals');
      if (window.innerWidth <= 768) setSidebarExpanded(false);
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
    setActiveDayIndex(0);
    setGeoActivities([]);
    setDayRestaurants([]);
    
    const pid = proposal.planId || proposal.id;
    if (pid && !savedPlans.includes(pid)) {
      const newSaved = [...savedPlans, pid];
      setSavedPlans(newSaved);
      localStorage.setItem('vIAja_saved_plans', JSON.stringify(newSaved));
    }
  };

  // ─── Load map data for a day ─────────────────────────────────────────────────────────

  const loadDayMap = useCallback(async (dayPlan, destination, country, rating) => {
    if (!dayPlan?.activities?.length) return;
    setMapLoading(true);
    setGeoActivities([]);
    setDayRestaurants([]);

    const city = [destination, country].filter(Boolean).join(', ');

    // 1. Geocode all activities in parallel (rate-limited: one at a time to be polite)
    const geoResults = [];
    for (const act of dayPlan.activities) {
      try {
        const actName = typeof act === 'string' ? act : act.name;
        const { data } = await axios.get('/api/geocode', {
          params: { query: `${actName}, ${city}` }
        });
        geoResults.push({ ...(typeof act === 'string' ? { name: act } : act), _lat: data.lat, _lng: data.lng });
      } catch {
        geoResults.push({ ...(typeof act === 'string' ? { name: act } : act), _lat: null, _lng: null });
      }
      // Small delay to respect Nominatim rate limit (1 req/s)
      await new Promise(r => setTimeout(r, 350));
    }
    setGeoActivities(geoResults);

    // 2. Find centroid of valid points for restaurant search
    const validPoints = geoResults.filter(a => a._lat && a._lng);
    let avgLat, avgLng, radius = 600;
    
    if (validPoints.length > 0) {
      avgLat = validPoints.reduce((s, a) => s + a._lat, 0) / validPoints.length;
      avgLng = validPoints.reduce((s, a) => s + a._lng, 0) / validPoints.length;
    } else {
      try {
        const { data } = await axios.get('/api/geocode', { params: { query: city } });
        if (data && data.lat && data.lng) {
          avgLat = data.lat;
          avgLng = data.lng;
          radius = 2000;
        }
      } catch (e) {
        console.error('Fallback geocode failed');
      }
    }

    if (avgLat && avgLng) {
      try {
        const { data: rests } = await axios.get('/api/restaurants', {
          params: { lat: avgLat, lng: avgLng, radius, minStars: rating }
        });
        setDayRestaurants(rests || []);
      } catch {
        setDayRestaurants([]);
      }
    } else {
      setDayRestaurants([]);
    }
    setMapLoading(false);
  }, []);

  // Auto-load map when selectedProposal changes (first day) or when browsing proposals in modal
  useEffect(() => {
    if (modalOpen && proposals[activeProposal]?.plan?.length > 0) {
      setActiveDayIndex(0);
      loadDayMap(proposals[activeProposal].plan[0], proposals[activeProposal].destination, proposals[activeProposal].country, minRating);
    } else if (!modalOpen && selectedProposal?.plan?.length > 0) {
      loadDayMap(selectedProposal.plan[0], selectedProposal.destination, selectedProposal.country, minRating);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProposal, modalOpen, activeProposal]);

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

  const renderDayPlanUI = (targetProposal, isModal = false) => {
    if (!targetProposal || !Array.isArray(targetProposal.plan) || targetProposal.plan.length === 0) return null;
    return (
      <div className={isModal ? "modal-section" : "result-section"}>
        <div className="plan-section-header">
          <h3 style={{ margin: 0 }} className={isModal ? "modal-section-title" : ""}>🗓️ Plan de viaje</h3>
          <div className="map-rating-filter">
            <label className="map-filter-label">
              ★ Min. estrellas:
              <select
                value={minRating}
                onChange={e => {
                  const r = parseFloat(e.target.value);
                  setMinRating(r);
                  if (targetProposal?.plan?.[activeDayIndex]) {
                    loadDayMap(targetProposal.plan[activeDayIndex], targetProposal.destination, targetProposal.country, r);
                  }
                }}
                className="map-filter-select"
              >
                <option value={0}>Todos</option>
                <option value={3}>3+</option>
                <option value={4}>4+</option>
                <option value={4.5}>4.5+</option>
              </select>
            </label>
          </div>
        </div>

        {/* Day tabs */}
        <div className="day-tabs">
          {targetProposal.plan.map((dayPlan, idx) => (
            <button
              key={dayPlan.day}
              className={`day-tab-btn ${activeDayIndex === idx ? 'active' : ''}`}
              onClick={() => {
                setActiveDayIndex(idx);
                loadDayMap(dayPlan, targetProposal.destination, targetProposal.country, minRating);
              }}
            >
              <span className="day-tab-num">Día {dayPlan.day}</span>
              <span className="day-tab-title">{dayPlan.title}</span>
            </button>
          ))}
        </div>

        {/* Active day detail */}
        {(() => {
          const dayPlan = targetProposal.plan[activeDayIndex];
          if (!dayPlan) return null;
          return (
            <div className="day-detail-panel" key={activeDayIndex}>
              {/* Map */}
              <div className="day-map-section">
                {mapLoading && (
                  <div className="map-loading-overlay">
                    <span className="spinner" style={{ borderTopColor: 'var(--accent-indigo)' }} />
                    <span>Geocodificando actividades y buscando restaurantes…</span>
                  </div>
                )}
                <DayMap
                  activities={geoActivities}
                  restaurants={dayRestaurants}
                  destination={targetProposal.destination}
                />
              </div>

              {/* Activities */}
              <div className="day-activities-panel">
                <div className="day-panel-title">
                  <span className="day-number-badge">Día {dayPlan.day}</span>
                  <span className="day-panel-ttl">{dayPlan.title}</span>
                </div>
                {Array.isArray(dayPlan.activities) && (
                  <ul className="activity-list rich">
                    {dayPlan.activities.map((act, i) => (
                      <li key={i} className="act-item-rich" style={{ listStyle: 'none' }}>
                        <div className="act-main">
                          <span className="act-num-badge">{i + 1}</span>
                          <span className="act-name">{typeof act === 'string' ? act : act.name}</span>
                          {typeof act !== 'string' && act.price && (
                            <span className={`act-price-badge ${act.price.toLowerCase().includes('gratis') ? 'free' : ''}`}>
                              {act.price.toLowerCase().includes('gratis') ? '🆓 Gratis' : `💶 ${act.price}`}
                            </span>
                          )}
                        </div>
                        {typeof act !== 'string' && act.description && <p className="act-description">{act.description}</p>}
                        {typeof act !== 'string' && act.url && (
                          <a href={act.url} target="_blank" rel="noopener noreferrer" className="act-url">
                            <span>🔗</span><span>Ver más</span>
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Restaurants section */}
                <div className="restaurants-section">
                  <div className="restaurants-title">
                    🍽️ Dónde comer cerca
                    {mapLoading && <span className="rest-loading-tag">Buscando…</span>}
                    {!mapLoading && dayRestaurants.length === 0 && geoActivities.length > 0 && (
                      <span className="rest-empty-tag">Sin resultados en esta zona</span>
                    )}
                  </div>
                  {dayRestaurants.length > 0 && (
                    <div className="restaurants-grid">
                      {dayRestaurants.map(r => <RestaurantCard key={r.id} r={r} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="dashboard-layout">
      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className={`dashboard-sidebar ${sidebarExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">✈️</span>
            {sidebarExpanded && <span className="sidebar-logo-text">vIAja</span>}
          </div>
          <button className="sidebar-toggle-btn" onClick={() => setSidebarExpanded(!sidebarExpanded)} aria-label="Toggle Sidebar">
            {sidebarExpanded ? '‹' : '›'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`sidebar-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">🏠</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Inicio</span>}
          </button>
          
          {proposals.length > 0 && (
            <button 
              className={`sidebar-nav-btn ${activeTab === 'proposals' ? 'active' : ''}`}
              onClick={() => { setActiveTab('proposals'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
            >
              <span className="sidebar-nav-icon">✨</span>
              {sidebarExpanded && <span className="sidebar-nav-text">Propuestas</span>}
              {sidebarExpanded && <span className="sidebar-nav-badge">3</span>}
            </button>
          )}

          <button 
            className={`sidebar-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">📚</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Guardados</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'all_history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('all_history'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">🕰️</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Historial</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-nav-btn theme-toggle" onClick={toggleTheme}>
            <span className="sidebar-nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarExpanded && <span className="sidebar-nav-text">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className="dashboard-main-content">
        {activeTab === 'home' && (
          <div className="dashboard-view home-view" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <header>
        
        <h1>vIAja</h1>
        <p className="subtitle">
          Planifica tu viaje ideal con recomendaciones inteligentes de destino, hospedaje y un asistente personal.
        </p>
      </header>
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

          {/* Plan de días con mapa */}
          {renderDayPlanUI(selectedProposal, false)}

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
        <p>vIAja · Impulsado por inteligencia artificial</p>
      </footer>
          </div>
        )}

        {activeTab === 'proposals' && proposals.length > 0 && (
          <div className="dashboard-view proposals-view">
            <div className="proposals-view-container" style={{ padding: "0", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
            <div className="dashboard-proposals-header">
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
                {renderDayPlanUI(currentProposal, true)}

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
          </div>
        )}

        {(activeTab === 'history' || activeTab === 'all_history') && (
          
  <div className="dashboard-view history-view" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
      <h2>{activeTab === 'history' ? '📚 Guardados' : '🕰️ Historial Completo'}</h2>
      {selectedHistoryGroup && (
        <button className="btn-secondary" onClick={() => setSelectedHistoryGroup(null)}>
          ⬅ Volver a grupos
        </button>
      )}
    </div>

    {!selectedHistoryGroup ? (
      <div className="history-groups-grid" style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {historyLoading ? (
          <div className="loading-spinner"><span className="spinner"></span></div>
        ) : (activeTab === 'history' ? historyPlans.filter(p => savedPlans.includes(p.id)) : historyPlans).length === 0 ? (
          <p>Aún no tienes viajes guardados. ¡Genera tu primero!</p>
        ) : (
          Object.entries(
            (activeTab === 'history' ? historyPlans.filter(p => savedPlans.includes(p.id)) : historyPlans).reduce((acc, plan) => {
              const type = plan.travelType || 'Otros';
              if (!acc[type]) acc[type] = [];
              acc[type].push(plan);
              return acc;
            }, {})
          ).map(([type, plans]) => (
            <button
              key={type}
              className="history-group-card card"
              onClick={() => setSelectedHistoryGroup(type)}
              style={{ padding: '24px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{type}</h3>
              <span className="badge badge-accent" style={{ background: 'var(--accent-indigo)', color: 'white', padding: '4px 12px', borderRadius: '20px' }}>
                {plans.length} viajes
              </span>
            </button>
          ))
        )}
      </div>
    ) : (
      <div className="previews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
        {(activeTab === 'history' ? historyPlans.filter(p => savedPlans.includes(p.id)) : historyPlans).filter(p => (p.travelType || 'Otros') === selectedHistoryGroup).map(plan => (
          <button
            key={plan.id}
            onClick={() => loadPlanFromHistory(plan.id, selectedHistoryGroup)}
            disabled={planLoading}
            className="card previews-card"
            style={{ padding: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
          >
            {plan.imageUrl ? (
              <img src={plan.imageUrl} alt={plan.destination} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />
            ) : (
              <div style={{ width: '100%', height: '180px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', borderRadius: '8px', marginBottom: '12px' }}>🌍</div>
            )}
            <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{plan.destination}</h4>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{plan.days} días · {formatDate(plan.createdAt)}</span>
          </button>
        ))}
      </div>
    )}
  </div>

        )}
      </main>
    </div>
  );
}
export default App;
