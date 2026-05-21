# Gestor de Viajes IA

Este repositorio es una web de asistente de viajes con soporte de IA usando Azure Foundry.

## Qué incluye

- Interfaz para elegir temporada, presupuesto y estilo de viaje
- Recomendación de destino inteligente
- Planificación de días del viaje
- Sugerencias de hospedaje según el enfoque
- Chat para resolver dudas sobre la planificación y el hostal
- Backend Express que se integra con Azure Foundry

## Estructura

- `front/` - aplicación React con formulario, resultados y chat
- `back/` - servidor Express para llamar al modelo de IA
- `.env.example` - variables de entorno necesarias

## Configuración

1. Copia `.env.example` a `.env`
2. Configura tus valores de Azure Foundry:
   - `AZURE_FOUNDRY_ENDPOINT`
   - `AZURE_FOUNDRY_API_KEY`
   - `AZURE_FOUNDRY_MODEL`
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Ejecuta el proyecto desde la raíz:
   ```bash
   npm run dev
   ```

## Uso

- En la web, elige temporada, presupuesto y enfoque del viaje.
- El asistente propone un destino, planifica los días y recomienda hospedaje.
- Usa el chat para hacer preguntas específicas sobre el plan y el hostal.

## Notas

Este proyecto asume que el modelo de IA está expuesto como un servicio de Azure Foundry. El backend está preparado para realizar la petición y devolver una respuesta al frontend.
