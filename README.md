# ✈️ vIAja

Planificador de viajes inteligente impulsado por **Azure AI Foundry** (GPT-4o-mini). Genera 3 propuestas de destino personalizadas, planifica cada día con actividades reales, recomienda hospedaje y muestra un **mapa interactivo** con la ruta diaria y restaurantes cercanos.

---

## 🚀 Funcionalidades

### Formulario de preferencias
- Selección de **temporada** (primavera / verano / otoño / invierno)
- **Presupuesto total** en euros
- **Enfoque del viaje** multi-selección: Monumentos, Gastronomía, Naturaleza, Fiesta, Familiar, Escapada o personalizado
- **Región de destino** multi-selección: Europa, Asia, América, España, etc.
- **Duración**: presets rápidos (fin de semana, 1 semana…) o selector de días exacto

### 3 Propuestas simultáneas con IA
- La IA genera en paralelo **3 destinos distintos**: Clásico ⭐, Alternativo 💎 y Exótico 🌏
- Cada propuesta incluye:
  - Imagen real del destino (vía Unsplash)
  - Justificación del destino ("¿Por qué este destino?")
  - Plan día a día con 3-4 actividades por día (nombre, descripción, precio, URL oficial)
  - 6 opciones de hospedaje (2 económico, 2 estándar, 2 premium) con precios y links de reserva

### 🗺️ Mapa interactivo con ruta diaria
Al seleccionar un destino aparece el plan completo con:
- **Tabs de días clicables** — al clicar un día se carga el mapa de esa jornada
- **Mapa Leaflet** (OpenStreetMap, sin coste) con:
  - Marcadores numerados ①②③ en cada monumento/actividad
  - Línea de ruta discontinua conectando los puntos en orden
  - Marcadores 🍽️ para restaurantes y bares cercanos en la ruta
- **Sección "Dónde comer cerca"** con tarjetas de restaurantes que incluyen:
  - Tipo de local (restaurante, bar, café, bistro…)
  - Tipo de cocina
  - Rating ⭐ con estrellas visuales
  - Horario de apertura
  - Botón "Ver en Maps" → Google Maps
- **Filtro de estrellas mínimas** (Todos / 3+ / 4+ / 4.5+) para los restaurantes

### 💬 Chat con memoria (RAG)
- Asistente conversacional sobre el viaje planificado
- Recuerda el contexto de **chats anteriores** en otros viajes similares (RAG semántico)

### 📚 Historial de viajes
- Todos los viajes generados se indexan automáticamente en **Azure AI Search**
- Panel lateral "Mis viajes" agrupa los planes por tipo de viaje
- Vista en cuadrícula estilo "polaroids" con imagen y fecha
- Recupera cualquier plan anterior con su chat histórico intacto

### 🎨 Diseño y UX
- Modo oscuro / claro con toggle
- Diseño glassmorphism con animaciones suaves
- Totalmente responsive (móvil, tablet, escritorio)

---

## 🏗️ Arquitectura

```
gestor_viajes/
├── front/              # React + Vite (UI)
│   └── src/
│       ├── App.jsx     # Toda la lógica de UI y componentes
│       └── styles.css  # Diseño completo con tokens CSS
├── back/               # Express (API)
│   ├── index.js        # Endpoints REST
│   └── services/
│       ├── azureSearch.js   # CRUD + búsqueda vectorial en Azure AI Search
│       └── embeddings.js    # Generación de embeddings (text-embedding-ada-002)
├── .env.example        # Plantilla de variables de entorno
└── package.json        # Scripts raíz (concurrently)
```

### API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/travel` | Genera 3 propuestas de viaje con IA |
| `POST` | `/api/chat` | Chat con el asistente sobre el viaje |
| `GET`  | `/api/history` | Lista todos los planes guardados |
| `GET`  | `/api/plan/:id` | Obtiene un plan completo por ID |
| `GET`  | `/api/geocode?query=` | Geocodifica un lugar (Nominatim/OSM) |
| `GET`  | `/api/restaurants?lat=&lng=&radius=&minStars=` | Restaurantes cercanos (Overpass API/OSM) |

### Servicios externos utilizados

| Servicio | Uso | Coste |
|----------|-----|-------|
| **Azure AI Foundry** (GPT-4o-mini) | Generación de propuestas y chat | De pago (Azure) |
| **Azure OpenAI** (text-embedding-ada-002) | Embeddings para RAG | De pago (Azure) |
| **Azure AI Search** | Almacenamiento e índice vectorial | De pago (Azure) |
| **Unsplash API** | Imágenes del destino | Gratis (50 req/hora) |
| **Nominatim** (OpenStreetMap) | Geocodificación de actividades | Gratis |
| **Overpass API** (OpenStreetMap) | Búsqueda de restaurantes cercanos | Gratis |
| **Leaflet.js** | Mapa interactivo | Gratis (open source) |

> Los servicios de OpenStreetMap (Nominatim + Overpass + Leaflet) son **100% gratuitos** y no requieren tarjeta de crédito. Solo Azure y Unsplash son opcionales/de pago.

---

## ⚙️ Configuración

### 1. Variables de entorno

Copia `.env.example` a `back/.env` y rellena los valores:

```bash
cp .env.example back/.env
```

**Obligatorias** (modelo de IA):
```env
AZURE_FOUNDRY_ENDPOINT=https://<tu-recurso>.openai.azure.com/openai/v1
AZURE_FOUNDRY_API_KEY=<tu-api-key>
AZURE_FOUNDRY_MODEL=gpt-4o-mini
PORT=4000
```

**Opcional — imágenes del destino** (gratis, registro en [unsplash.com/developers](https://unsplash.com/developers)):
```env
UNSPLASH_ACCESS_KEY=<tu-unsplash-key>
```

**Opcional — Historial y RAG** (requiere Azure AI Search + Azure OpenAI Embeddings):
```env
AZURE_EMBEDDING_ENDPOINT=https://<tu-recurso>.openai.azure.com/openai/v1
AZURE_EMBEDDING_API_KEY=<tu-embedding-api-key>
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

AZURE_SEARCH_ENDPOINT=https://<tu-servicio>.search.windows.net
AZURE_SEARCH_API_KEY=<tu-admin-key>
AZURE_SEARCH_INDEX=travel-plans
```

> Si no configuras las variables de RAG, el historial y la búsqueda semántica se desactivan automáticamente sin romper la app.

### 2. Instalación

Desde la raíz del proyecto:

```bash
npm install          # instala dependencias de front y back
```

O manualmente:
```bash
cd front && npm install
cd ../back && npm install
```

### 3. Arranque en desarrollo

```bash
npm run dev          # arranca front (Vite :5173) y back (Express :4000) en paralelo
```

O por separado:
```bash
# Terminal 1 – Backend
cd back && node index.js

# Terminal 2 – Frontend
cd front && npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en el navegador.

---

## 🗄️ Configuración de Azure AI Search (para el Historial)

Si quieres activar el historial y el RAG, necesitas crear manualmente el índice en Azure AI Search con los siguientes campos:

| Campo | Tipo | Atributos |
|-------|------|-----------|
| `id` | Edm.String | Key, Retrievable |
| `destination` | Edm.String | Retrievable, Searchable |
| `country` | Edm.String | Retrievable |
| `season` | Edm.String | Retrievable, Filterable |
| `budget` | Edm.String | Retrievable |
| `travelType` | Edm.String | Retrievable, Filterable |
| `days` | Edm.Int32 | Retrievable |
| `why` | Edm.String | Retrievable |
| `planText` | Edm.String | Retrievable, Searchable |
| `planJson` | Edm.String | Retrievable |
| `lodgingText` | Edm.String | Retrievable |
| `lodgingJson` | Edm.String | Retrievable |
| `imageUrl` | Edm.String | Retrievable |
| `chatHistory` | Edm.String | Retrievable |
| `createdAt` | Edm.DateTimeOffset | Retrievable, Sortable |
| `embedding` | Collection(Edm.Single) | Dimensions: 1536, Algorithm: HNSW |

---

## 📦 Tecnologías

**Frontend**
- React 18 + Vite 5
- Leaflet.js (mapas)
- Axios (peticiones HTTP)
- CSS vanilla con design tokens

**Backend**
- Node.js + Express
- Azure AI Foundry / Azure OpenAI (generación + embeddings)
- Azure AI Search (almacenamiento vectorial + historial)
- Nominatim / Overpass API (geocodificación y restaurantes, OpenStreetMap)
- Unsplash API (imágenes)

---

## 🧠 Cómo funciona el RAG

1. Al generar un viaje, se crea un **embedding** (vector de 1536 dimensiones) del plan completo
2. El vector se indexa en Azure AI Search junto con los metadatos del plan
3. Al generar nuevas propuestas, se buscan viajes similares ya planificados para **evitar repetir destinos** y mejorar las sugerencias
4. En el chat, las preguntas también se vectorizan y se recupera contexto de **conversaciones pasadas** relevantes
