#  trIAvel

Planificador de viajes inteligente impulsado por **Azure AI Foundry** (GPT-4o-mini). Genera 3 propuestas de destino personalizadas simultáneamente, planifica cada día con actividades reales, recomienda hospedaje y muestra un **mapa interactivo** con la ruta diaria y los restaurantes más cercanos. Todo en una interfaz moderna y dividida en pestañas para una experiencia inmersiva.

---

##  Funcionalidades Principales

###  Formulario de Búsqueda Personalizada
La pantalla de inicio está dedicada exclusivamente a definir tu viaje ideal:
- **Temporada**: Primavera / Verano / Otoño / Invierno
- **Presupuesto total** en euros
- **Enfoque del viaje** (Multi-selección): Monumentos, Gastronomía, Naturaleza, Fiesta, Familiar, Escapada o incluso enfoques personalizados.
- **Región de destino** (Multi-selección): Europa, Asia, América, España o cualquier parte del mundo.
- **Duración**: Selección rápida mediante presets (fin de semana, 1 semana, etc.) o días exactos (stepper).
- **Multi-idioma**: Soporte completo de interfaz en Español, Inglés, Francés, Alemán, Portugués e Italiano.

###  3 Propuestas con Inteligencia Artificial
La IA procesa tus preferencias y genera en paralelo **3 destinos distintos** clasificados según su perfil:
-  **Clásico**: Destinos icónicos y consolidados.
-  **Alternativo**: Lugares de gran valor pero menos masificados.
-  **Exótico**: Para una aventura inolvidable.

Cada propuesta te mostrará una imagen real, la justificación de la IA, el plan diario y opciones de alojamiento. Al pulsar en "Elegir este destino", la propuesta se guardará de forma permanente y podrás interactuar con ella a fondo.

### 📚 Historial y Viajes Guardados
Tus viajes elegidos y generados se gestionan en las vistas de **Guardados** e **Historial**:
- Todos los viajes generados se indexan automáticamente en **Azure AI Search**.
- Interfaz en cuadrícula (estilo *polaroid*) con agrupación automática según el estilo de viaje.
- Acceso inmediato para reanudar la planificación o la conversación con el asistente sobre cualquier destino del pasado.

### 🪟 Vista Detallada de Destino y Chat
Al acceder a un viaje guardado, entrarás en una vista inmersiva que ocupa toda tu pantalla, dividida en pestañas para evitar el desorden visual:
- ** Chat Inteligente (RAG)**: Conversa con el asistente virtual específicamente sobre este destino. El chat ocupa todo el espacio sobrante de tu pantalla para resultar natural, e incluye "Memoria" (contexto de conversaciones en otros viajes similares).
- ** Información del destino**: Visualiza el desglose completo del viaje generado por la IA, que incluye:
  - **Plan día a día**: Actividades con nombre, precio estimado y descripción.
  - **Opciones de Hospedaje**: Organizadas en Económico, Estándar y Premium (con enlaces web reales).
  - **Mapa Interactivo Leaflet**: Integra OpenStreetMap y la geocodificación de Nominatim sin coste. Traza la ruta recomendada con marcadores numerados.
  - **Restaurantes cercanos**: Mediante la API de Overpass, busca restaurantes cercanos al punto central de las actividades del día, con filtrado por valoración de estrellas.

### 🎨 Diseño y UX "Glassmorphism"
- Efectos translúcidos y bordes difuminados, muy elegante.
- Modo oscuro / modo claro completamente adaptativo.
- Disposición *responsive*, el menú lateral se oculta y las ventanas se adaptan (Flexbox) para no tener barras de scroll innecesarias.

---

## 🏗️ Arquitectura del Proyecto

```
gestor_viajes/
├── front/              # React + Vite (Frontend UI)
│   └── src/
│       ├── App.jsx     # Toda la lógica de componentes, estado global, tabs y enrutamiento interno
│       └── styles.css  # Diseño, design tokens CSS y layout flexbox dinámico
├── back/               # Node.js + Express (Backend API)
│   ├── index.js        # Endpoints REST (ChatGPT, Geocode, OSMap)
│   └── services/
│       ├── azureSearch.js   # Interacción con Azure AI Search (CRUD + búsqueda vectorial)
│       └── embeddings.js    # Generación de embeddings (text-embedding-ada-002)
├── .env.example        # Plantilla de variables de entorno
└── package.json        # Scripts raíz para arranque simultáneo (concurrently)
```

### API Endpoints (Backend)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/travel` | Genera 3 propuestas de viaje usando GPT-4o-mini |
| `POST` | `/api/chat` | Chat interactivo con el asistente (con RAG opcional) |
| `GET`  | `/api/history` | Recupera el listado de planes generados del índice Azure |
| `GET`  | `/api/plan/:id` | Devuelve un plan completo y el historial de su chat asociado |
| `GET`  | `/api/geocode?query=` | Llama a Nominatim (OSM) para obtener coordenadas (lat, lng) |
| `GET`  | `/api/restaurants?...` | Llama a Overpass (OSM) para restaurantes según radio y centroide |

### Servicios externos integrados

| Servicio | Finalidad | Coste y Disponibilidad |
|----------|-----------|------------------------|
| **Azure AI Foundry** (GPT-4o) | Generación de texto (Propuestas + Chat) | De pago (Azure) |
| **Azure OpenAI** (text-embedding) | Vectores para búsquedas semánticas (RAG) | De pago (Azure) |
| **Azure AI Search** | Almacenamiento vectorial e Historial de la DB | De pago (Azure) |
| **Unsplash API** | Imágenes atractivas de portada de destino | Gratis (hasta 50 req/h) |
| **Nominatim / OSM** | Búsqueda de coordenadas | Gratis (1 req/s máx) |
| **Overpass API / OSM** | Base de datos geolocalizada de restaurantes | Gratis |
| **Leaflet.js** | Visualización de Mapas Dinámicos | Open Source |

---

## ⚙️ Configuración y Puesta en Marcha

### 1. Variables de entorno

Copia `.env.example` a `back/.env` y rellena con tus claves:

```bash
cp .env.example back/.env
```

**Bloque obligatorio (Modelo Base):**
```env
AZURE_FOUNDRY_ENDPOINT=https://<tu-recurso>.openai.azure.com/openai/v1
AZURE_FOUNDRY_API_KEY=<tu-api-key>
AZURE_FOUNDRY_MODEL=gpt-4o-mini
PORT=4000
```

**Bloque para imágenes fotográficas (Opcional, en [Unsplash Developers](https://unsplash.com/developers)):**
```env
UNSPLASH_ACCESS_KEY=<tu-unsplash-key>
```

**Bloque RAG e Historial (Opcional, requiere entorno completo Azure AI):**
```env
AZURE_EMBEDDING_ENDPOINT=https://<tu-recurso>.openai.azure.com/openai/v1
AZURE_EMBEDDING_API_KEY=<tu-embedding-api-key>
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

AZURE_SEARCH_ENDPOINT=https://<tu-servicio>.search.windows.net
AZURE_SEARCH_API_KEY=<tu-admin-key>
AZURE_SEARCH_INDEX=travel-plans
```
> *Nota: Si las variables de Azure AI Search no están presentes, la aplicación continuará funcionando guardando planes únicamente en tu disco local `localStorage` de React, y el servicio RAG estará en reposo.*

### 2. Instalación de dependencias

Instala los módulos tanto del servidor Express como del cliente React Vite. Puedes hacerlo desde la raíz si usas un monorepo automatizado, o de forma manual:

```bash
cd front && npm install
cd ../back && npm install
```

### 3. Arranque en desarrollo

Puedes iniciar ambos servidores al mismo tiempo mediante `npm run dev` en el `package.json` principal (si utilizas concurrently), o por separado:

```bash
# Terminal 1: Arrancar Backend (puerto 4000)
cd back && node index.js

# Terminal 2: Arrancar Frontend (puerto 5173 por defecto)
cd front && npm run dev
```

La aplicación estará disponible en [http://localhost:5173](http://localhost:5173).

---

## 🗄️ Esquema del Índice en Azure AI Search

Si deseas activar todas las funciones avanzadas y has configurado tu conexión a Azure Search, asegúrate de crear el índice (por ej. `travel-plans`) con estos campos:

| Nombre del Campo | Tipo de Dato | Atributos Especiales |
|------------------|--------------|----------------------|
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
| `embedding` | Collection(Edm.Single) | Dimensiones: 1536, Algoritmo: HNSW |

## 🧠 Flujo de Generación Aumentada por Recuperación (RAG)

1. Al generarse un itinerario, todos los textos del viaje se procesan mediante un modelo de embeddings, resultando en un vector matemático que define el significado de ese viaje.
2. Este vector numérico se consolida y guarda en **Azure AI Search**.
3. Cuando interactúas con el Chat en cualquier momento posterior, tu pregunta también es "vectorizada".
4. El backend busca las interacciones semánticamente más cercanas en toda tu base de datos de historial y le envía ese contexto al modelo GPT, dándole una "memoria externa" de todo lo que habéis discutido previamente o planes similares de la comunidad.
