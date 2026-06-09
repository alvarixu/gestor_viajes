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

// ─── i18n ─────────────────────────────────────────────────────────────────────

const LANGUAGES = [
 { code: 'es', label: 'Español', flag: '', nativeName: 'Español' },
 { code: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
 { code: 'fr', label: 'Français', flag: '🇫🇷', nativeName: 'Français' },
 { code: 'de', label: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
 { code: 'pt', label: 'Português', flag: '🇵🇹', nativeName: 'Português' },
 { code: 'it', label: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano' },
];

const TRANSLATIONS = {
 es: {
 appName: 'trIAvel',
 subtitle: 'Planifica tu viaje ideal con recomendaciones inteligentes de destino, hospedaje y un asistente personal.',
 navHome: 'Inicio', navProposals: 'Propuestas', navSaved: 'Guardados', navHistory: 'Historial', navLanguage: 'Idioma',
 themeLight: 'Claro', themeDark: 'Oscuro',
 formTitle: 'Personaliza tu viaje',
 season: 'Temporada', budget: 'Presupuesto total',
 travelFocus: 'Enfoque del viaje (Puedes marcar varios)',
 whereGo: '¿A dónde te gustaría ir? (Puedes marcar varias)',
 duration: 'Duración del viaje',
 orChoose: 'O elige exactamente:',
 day: 'día', days: 'días',
 generateBtn: ' Proponer 3 destinos', generatingBtn: 'Generando 3 propuestas...',
 loading0: 'Analizando la temporada y tus preferencias...', loading1: 'Buscando 3 destinos únicos para ti...', loading2: 'Planificando cada día de los viajes...', loading3: 'Buscando el hospedaje ideal para cada destino...',
 customPlaceholder: 'Ej. luna de miel romántica, viaje fotográfico, turismo sostenible...',
 customLabel: 'Describe tu tipo de viaje',
 yourDestination: 'Tu destino elegido', changeDestination: 'Cambiar destino',
 whyTitle: '¿Por qué este destino?',
 travelPlan: '🗓️ Plan de viaje',
 lodgingTitle: '🏨 Opciones de hospedaje',
 chatTitle: 'Preguntas sobre tu plan',
 chatWithMemory: '🧠 Con memoria',
 chatEmpty: 'Haz una pregunta sobre tu destino, hospedaje o plan de viaje',
 chatPlaceholder: 'Pregunta sobre el destino, hospedaje o plan...',
 chatSend: 'Enviar',
 savedTitle: ' Guardados', historyTitle: ' Historial Completo',
 noSaved: '¡Aún no tienes viajes guardados. Genera tu primero!',
 backToGroups: '⬅ Volver a grupos',
 trips: 'viajes',
 proposalsTitle: 'Tus 3 propuestas de viaje',
 chooseDestination: 'Elegir este destino',
 minStars: '★ Min. estrellas:', allStars: 'Todos',
 nearbyFood: ' Dónde comer cerca',
 searching: 'Buscando…',
 noResults: 'Sin resultados en esta zona',
 geocoding: 'Geocodificando actividades y buscando restaurantes…',
 activity: 'Actividad', restaurant: 'Restaurante', route: 'Ruta',
 seeMore: 'Ver más', book: 'Reservar', seeInMaps: 'Ver en Maps →',
 recommended: 'Destino recomendado',
 footer: 'trIAvel · Impulsado por inteligencia artificial',
 langTabTitle: 'Selecciona tu idioma',
 langTabDesc: 'La interfaz se mostrará en el idioma elegido.',
 backTo: 'Volver a',
 proposals3: 'Tus 3 propuestas de viaje',
 classic: 'Clásico', alt: 'Alternativo', exotic: 'Exótico',
 classicDesc: 'Popular y probado', altDesc: 'Joya oculta', exoticDesc: 'Fuera de lo común',
 eco: 'Económico', std: 'Estándar', prem: 'Premium',
 saved: 'Guardado',
 similarTrips: 'Destinos similares que ya has explorado',
 viewTrip: 'Ver viaje →',
 },
 en: {
 appName: 'trIAvel',
 subtitle: 'Plan your ideal trip with smart destination, lodging recommendations and a personal assistant.',
 navHome: 'Home', navProposals: 'Proposals', navSaved: 'Saved', navHistory: 'History', navLanguage: 'Language',
 themeLight: 'Light', themeDark: 'Dark',
 formTitle: 'Customize your trip',
 season: 'Season', budget: 'Total budget',
 travelFocus: 'Trip focus (you can select multiple)',
 whereGo: 'Where would you like to go? (you can select multiple)',
 duration: 'Trip duration',
 orChoose: 'Or choose exactly:',
 day: 'day', days: 'days',
 generateBtn: ' Suggest 3 destinations', generatingBtn: 'Generating 3 proposals...',
 loading0: 'Analyzing the season and your preferences...', loading1: 'Searching for 3 unique destinations for you...', loading2: 'Planning each day of the trips...', loading3: 'Finding the ideal accommodation for each destination...',
 customPlaceholder: 'E.g. romantic honeymoon, photography trip, sustainable tourism...',
 customLabel: 'Describe your trip type',
 yourDestination: 'Your chosen destination', changeDestination: 'Change destination',
 whyTitle: 'Why this destination?',
 travelPlan: '🗓️ Travel plan',
 lodgingTitle: '🏨 Accommodation options',
 chatTitle: 'Questions about your plan',
 chatWithMemory: '🧠 With memory',
 chatEmpty: 'Ask a question about your destination, accommodation or travel plan',
 chatPlaceholder: 'Ask about the destination, accommodation or plan...',
 chatSend: 'Send',
 savedTitle: ' Saved', historyTitle: ' Full History',
 noSaved: 'No saved trips yet. Generate your first one!',
 backToGroups: '⬅ Back to groups',
 trips: 'trips',
 proposalsTitle: 'Your 3 travel proposals',
 chooseDestination: 'Choose this destination',
 minStars: '★ Min. stars:', allStars: 'All',
 nearbyFood: ' Where to eat nearby',
 searching: 'Searching…',
 noResults: 'No results in this area',
 geocoding: 'Geocoding activities and searching for restaurants…',
 activity: 'Activity', restaurant: 'Restaurant', route: 'Route',
 seeMore: 'See more', book: 'Book', seeInMaps: 'See on Maps →',
 recommended: 'Recommended destination',
 footer: 'trIAvel · Powered by artificial intelligence',
 langTabTitle: 'Select your language',
 langTabDesc: 'The interface will be shown in the chosen language.',
 backTo: 'Back to',
 proposals3: 'Your 3 travel proposals',
 classic: 'Classic', alt: 'Alternative', exotic: 'Exotic',
 classicDesc: 'Popular and proven', altDesc: 'Hidden gem', exoticDesc: 'Off the beaten path',
 eco: 'Budget', std: 'Standard', prem: 'Premium',
 saved: 'Saved',
 similarTrips: 'Similar destinations you have already explored',
 viewTrip: 'View trip →',
 },
 fr: {
 appName: 'trIAvel',
 subtitle: 'Planifiez votre voyage idéal avec des recommandations intelligentes de destination, hébergement et un assistant personnel.',
 navHome: 'Accueil', navProposals: 'Propositions', navSaved: 'Enregistrés', navHistory: 'Historique', navLanguage: 'Langue',
 themeLight: 'Clair', themeDark: 'Sombre',
 formTitle: 'Personnalisez votre voyage',
 season: 'Saison', budget: 'Budget total',
 travelFocus: 'Thème du voyage (vous pouvez en choisir plusieurs)',
 whereGo: 'Où aimeriez-vous aller ? (vous pouvez en choisir plusieurs)',
 duration: 'Durée du voyage',
 orChoose: 'Ou choisissez exactement :',
 day: 'jour', days: 'jours',
 generateBtn: ' Proposer 3 destinations', generatingBtn: 'Génération en cours...',
 loading0: 'Analyse de la saison et de vos préférences...', loading1: 'Recherche de 3 destinations uniques pour vous...', loading2: 'Planification de chaque journée...', loading3: "Recherche de l'hébergement idéal...",
 customPlaceholder: 'Ex. lune de miel romantique, voyage photo, tourisme durable...',
 customLabel: 'Décrivez votre type de voyage',
 yourDestination: 'Votre destination choisie', changeDestination: 'Changer de destination',
 whyTitle: 'Pourquoi cette destination ?',
 travelPlan: '🗓️ Plan de voyage',
 lodgingTitle: "🏨 Options d'hébergement",
 chatTitle: 'Questions sur votre plan',
 chatWithMemory: '🧠 Avec mémoire',
 chatEmpty: 'Posez une question sur votre destination, hébergement ou plan de voyage',
 chatPlaceholder: "Question sur la destination, l'hébergement ou le plan...",
 chatSend: 'Envoyer',
 savedTitle: ' Enregistrés', historyTitle: ' Historique complet',
 noSaved: 'Pas encore de voyages enregistrés. Générez le premier !',
 backToGroups: '⬅ Retour aux groupes',
 trips: 'voyages',
 proposalsTitle: 'Vos 3 propositions de voyage',
 chooseDestination: 'Choisir cette destination',
 minStars: '★ Étoiles min. :', allStars: 'Tous',
 nearbyFood: ' Où manger à proximité',
 searching: 'Recherche…',
 noResults: 'Aucun résultat dans cette zone',
 geocoding: 'Géocodage des activités et recherche de restaurants…',
 activity: 'Activité', restaurant: 'Restaurant', route: 'Itinéraire',
 seeMore: 'Voir plus', book: 'Réserver', seeInMaps: 'Voir sur Maps →',
 recommended: 'Destination recommandée',
 footer: "trIAvel · Propulsé par l'intelligence artificielle",
 langTabTitle: 'Sélectionnez votre langue',
 langTabDesc: "L'interface s'affichera dans la langue choisie.",
 backTo: 'Retour à',
 proposals3: 'Vos 3 propositions de voyage',
 classic: 'Classique', alt: 'Alternatif', exotic: 'Exotique',
 classicDesc: 'Populaire et éprouvé', altDesc: 'Perle cachée', exoticDesc: 'Hors des sentiers battus',
 eco: 'Économique', std: 'Standard', prem: 'Premium',
 saved: 'Enregistré',
 similarTrips: 'Destinations similaires déjà explorées',
 viewTrip: 'Voir le voyage →',
 },
 de: {
 appName: 'trIAvel',
 subtitle: 'Plane deine ideale Reise mit intelligenten Empfehlungen für Ziel, Unterkunft und einem persönlichen Assistenten.',
 navHome: 'Start', navProposals: 'Vorschläge', navSaved: 'Gespeichert', navHistory: 'Verlauf', navLanguage: 'Sprache',
 themeLight: 'Hell', themeDark: 'Dunkel',
 formTitle: 'Passe deine Reise an',
 season: 'Jahreszeit', budget: 'Gesamtbudget',
 travelFocus: 'Reiseschwerpunkt (Mehrfachauswahl möglich)',
 whereGo: 'Wohin möchtest du reisen? (Mehrfachauswahl möglich)',
 duration: 'Reisedauer',
 orChoose: 'Oder genau auswählen:',
 day: 'Tag', days: 'Tage',
 generateBtn: ' 3 Ziele vorschlagen', generatingBtn: '3 Vorschläge werden erstellt...',
 loading0: 'Saison und Präferenzen werden analysiert...', loading1: '3 einzigartige Ziele werden gesucht...', loading2: 'Jeder Reisetag wird geplant...', loading3: 'Ideale Unterkunft für jedes Ziel wird gesucht...',
 customPlaceholder: 'Z.B. Romantische Flitterwochen, Fotoreise, nachhaltiger Tourismus...',
 customLabel: 'Beschreibe deine Reiseart',
 yourDestination: 'Dein gewähltes Ziel', changeDestination: 'Ziel ändern',
 whyTitle: 'Warum dieses Ziel?',
 travelPlan: '🗓️ Reiseplan',
 lodgingTitle: '🏨 Unterkunftsmöglichkeiten',
 chatTitle: 'Fragen zu deinem Plan',
 chatWithMemory: '🧠 Mit Gedächtnis',
 chatEmpty: 'Stelle eine Frage zu deinem Ziel, Unterkunft oder Reiseplan',
 chatPlaceholder: 'Frage zum Ziel, Unterkunft oder Plan...',
 chatSend: 'Senden',
 savedTitle: ' Gespeichert', historyTitle: ' Gesamter Verlauf',
 noSaved: 'Noch keine gespeicherten Reisen. Erstelle deine erste!',
 backToGroups: '⬅ Zurück zu Gruppen',
 trips: 'Reisen',
 proposalsTitle: 'Deine 3 Reisevorschläge',
 chooseDestination: 'Dieses Ziel wählen',
 minStars: '★ Min. Sterne:', allStars: 'Alle',
 nearbyFood: ' Wo in der Nähe essen',
 searching: 'Suche…',
 noResults: 'Keine Ergebnisse in diesem Bereich',
 geocoding: 'Aktivitäten werden geocodiert und Restaurants gesucht…',
 activity: 'Aktivität', restaurant: 'Restaurant', route: 'Route',
 seeMore: 'Mehr sehen', book: 'Buchen', seeInMaps: 'Auf Maps ansehen →',
 recommended: 'Empfohlenes Ziel',
 footer: 'trIAvel · Betrieben durch künstliche Intelligenz',
 langTabTitle: 'Sprache auswählen',
 langTabDesc: 'Die Benutzeroberfläche wird in der gewählten Sprache angezeigt.',
 backTo: 'Zurück zu',
 proposals3: 'Deine 3 Reisevorschläge',
 classic: 'Klassisch', alt: 'Alternativ', exotic: 'Exotisch',
 classicDesc: 'Beliebt und bewährt', altDesc: 'Verborgenes Juwel', exoticDesc: 'Abseits der Touristenpfade',
 eco: 'Günstig', std: 'Standard', prem: 'Premium',
 saved: 'Gespeichert',
 similarTrips: 'Ähnliche Ziele, die du bereits erkundet hast',
 viewTrip: 'Reise ansehen →',
 },
 pt: {
 appName: 'trIAvel',
 subtitle: 'Planeie a sua viagem ideal com recomendações inteligentes de destino, alojamento e um assistente pessoal.',
 navHome: 'Início', navProposals: 'Propostas', navSaved: 'Guardados', navHistory: 'Histórico', navLanguage: 'Idioma',
 themeLight: 'Claro', themeDark: 'Escuro',
 formTitle: 'Personalize a sua viagem',
 season: 'Estação', budget: 'Orçamento total',
 travelFocus: 'Foco da viagem (pode selecionar vários)',
 whereGo: 'Para onde gostaria de ir? (pode selecionar vários)',
 duration: 'Duração da viagem',
 orChoose: 'Ou escolha exatamente:',
 day: 'dia', days: 'dias',
 generateBtn: ' Propor 3 destinos', generatingBtn: 'A gerar 3 propostas...',
 loading0: 'A analisar a estação e as suas preferências...', loading1: 'A procurar 3 destinos únicos para si...', loading2: 'A planear cada dia das viagens...', loading3: 'A encontrar o alojamento ideal para cada destino...',
 customPlaceholder: 'Ex. lua de mel romântica, viagem fotográfica, turismo sustentável...',
 customLabel: 'Descreva o tipo de viagem',
 yourDestination: 'O seu destino escolhido', changeDestination: 'Mudar destino',
 whyTitle: 'Porquê este destino?',
 travelPlan: '🗓️ Plano de viagem',
 lodgingTitle: '🏨 Opções de alojamento',
 chatTitle: 'Perguntas sobre o seu plano',
 chatWithMemory: '🧠 Com memória',
 chatEmpty: 'Faça uma pergunta sobre o destino, alojamento ou plano de viagem',
 chatPlaceholder: 'Pergunta sobre o destino, alojamento ou plano...',
 chatSend: 'Enviar',
 savedTitle: ' Guardados', historyTitle: ' Histórico Completo',
 noSaved: 'Ainda não tem viagens guardadas. Gere a sua primeira!',
 backToGroups: '⬅ Voltar aos grupos',
 trips: 'viagens',
 proposalsTitle: 'As suas 3 propostas de viagem',
 chooseDestination: 'Escolher este destino',
 minStars: '★ Estrelas mín.:', allStars: 'Todos',
 nearbyFood: ' Onde comer perto',
 searching: 'A procurar…',
 noResults: 'Sem resultados nesta área',
 geocoding: 'A geocodificar atividades e a procurar restaurantes…',
 activity: 'Atividade', restaurant: 'Restaurante', route: 'Rota',
 seeMore: 'Ver mais', book: 'Reservar', seeInMaps: 'Ver no Maps →',
 recommended: 'Destino recomendado',
 footer: 'trIAvel · Alimentado por inteligência artificial',
 langTabTitle: 'Selecione o seu idioma',
 langTabDesc: 'A interface será exibida no idioma escolhido.',
 backTo: 'Voltar a',
 proposals3: 'As suas 3 propostas de viagem',
 classic: 'Clássico', alt: 'Alternativo', exotic: 'Exótico',
 classicDesc: 'Popular e comprovado', altDesc: 'Joia escondida', exoticDesc: 'Fora do comum',
 eco: 'Económico', std: 'Standard', prem: 'Premium',
 saved: 'Guardado',
 similarTrips: 'Destinos semelhantes que já explorou',
 viewTrip: 'Ver viagem →',
 },
 it: {
 appName: 'trIAvel',
 subtitle: 'Pianifica il tuo viaggio ideale con raccomandazioni intelligenti su destinazione, alloggio e un assistente personale.',
 navHome: 'Home', navProposals: 'Proposte', navSaved: 'Salvati', navHistory: 'Cronologia', navLanguage: 'Lingua',
 themeLight: 'Chiaro', themeDark: 'Scuro',
 formTitle: 'Personalizza il tuo viaggio',
 season: 'Stagione', budget: 'Budget totale',
 travelFocus: 'Focus del viaggio (puoi selezionarne più di uno)',
 whereGo: 'Dove vorresti andare? (puoi selezionarne più di uno)',
 duration: 'Durata del viaggio',
 orChoose: 'O scegli esattamente:',
 day: 'giorno', days: 'giorni',
 generateBtn: ' Proponi 3 destinazioni', generatingBtn: 'Creazione di 3 proposte...',
 loading0: 'Analisi della stagione e delle preferenze...', loading1: 'Ricerca di 3 destinazioni uniche per te...', loading2: 'Pianificazione di ogni giorno dei viaggi...', loading3: "Ricerca dell'alloggio ideale per ogni destinazione...",
 customPlaceholder: 'Es. luna di miele romantica, viaggio fotografico, turismo sostenibile...',
 customLabel: 'Descrivi il tipo di viaggio',
 yourDestination: 'La tua destinazione scelta', changeDestination: 'Cambia destinazione',
 whyTitle: 'Perché questa destinazione?',
 travelPlan: '🗓️ Piano di viaggio',
 lodgingTitle: '🏨 Opzioni di alloggio',
 chatTitle: 'Domande sul tuo piano',
 chatWithMemory: '🧠 Con memoria',
 chatEmpty: 'Fai una domanda sulla tua destinazione, alloggio o piano di viaggio',
 chatPlaceholder: 'Domanda sulla destinazione, alloggio o piano...',
 chatSend: 'Invia',
 savedTitle: ' Salvati', historyTitle: ' Cronologia completa',
 noSaved: 'Nessun viaggio salvato ancora. Genera il primo!',
 backToGroups: '⬅ Torna ai gruppi',
 trips: 'viaggi',
 proposalsTitle: 'Le tue 3 proposte di viaggio',
 chooseDestination: 'Scegli questa destinazione',
 minStars: '★ Stelle min.:', allStars: 'Tutti',
 nearbyFood: ' Dove mangiare nei dintorni',
 searching: 'Ricerca…',
 noResults: 'Nessun risultato in questa area',
 geocoding: 'Geocodifica delle attività e ricerca di ristoranti…',
 activity: 'Attività', restaurant: 'Ristorante', route: 'Percorso',
 seeMore: 'Scopri di più', book: 'Prenota', seeInMaps: 'Vedi su Maps →',
 recommended: 'Destinazione consigliata',
 footer: "trIAvel · Alimentato dall'intelligenza artificiale",
 langTabTitle: 'Seleziona la tua lingua',
 langTabDesc: "L'interfaccia verrà mostrata nella lingua scelta.",
 backTo: 'Torna a',
 proposals3: 'Le tue 3 proposte di viaggio',
 classic: 'Classico', alt: 'Alternativo', exotic: 'Esotico',
 classicDesc: 'Popolare e collaudato', altDesc: 'Gemma nascosta', exoticDesc: 'Fuori dai sentieri battuti',
 eco: 'Economico', std: 'Standard', prem: 'Premium',
 saved: 'Salvato',
 similarTrips: 'Destinazioni simili che hai già esplorato',
 viewTrip: 'Vedi viaggio →',
 },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRAVEL_TYPES_BY_LANG = {
 es: [
 { value: 'fiesta', label: 'Fiesta y vida nocturna' },
 { value: 'monumentos', label: 'Monumentos y cultura' },
 { value: 'escapada', label: 'Escapada mental' },
 { value: 'naturaleza', label: 'Naturaleza y aventura' },
 { value: 'gastronomia', label: 'Gastronomía' },
 { value: 'familiar', label: 'Viaje familiar' },
 { value: 'custom', label: 'Personalizado…' }
 ],
 en: [
 { value: 'fiesta', label: 'Party & nightlife' },
 { value: 'monumentos', label: 'Monuments & culture' },
 { value: 'escapada', label: 'Mental escape' },
 { value: 'naturaleza', label: 'Nature & adventure' },
 { value: 'gastronomia', label: 'Gastronomy' },
 { value: 'familiar', label: 'Family trip' },
 { value: 'custom', label: 'Custom…' }
 ],
 fr: [
 { value: 'fiesta', label: 'Fête & vie nocturne' },
 { value: 'monumentos', label: 'Monuments & culture' },
 { value: 'escapada', label: 'Escapade mentale' },
 { value: 'naturaleza', label: 'Nature & aventure' },
 { value: 'gastronomia', label: 'Gastronomie' },
 { value: 'familiar', label: 'Voyage en famille' },
 { value: 'custom', label: 'Personnalisé…' }
 ],
 de: [
 { value: 'fiesta', label: 'Party & Nachtleben' },
 { value: 'monumentos', label: 'Sehenswürdigkeiten & Kultur' },
 { value: 'escapada', label: 'Mentale Auszeit' },
 { value: 'naturaleza', label: 'Natur & Abenteuer' },
 { value: 'gastronomia', label: 'Gastronomie' },
 { value: 'familiar', label: 'Familienreise' },
 { value: 'custom', label: 'Individuell…' }
 ],
 pt: [
 { value: 'fiesta', label: 'Festa & vida noturna' },
 { value: 'monumentos', label: 'Monumentos & cultura' },
 { value: 'escapada', label: 'Escapadela mental' },
 { value: 'naturaleza', label: 'Natureza & aventura' },
 { value: 'gastronomia', label: 'Gastronomia' },
 { value: 'familiar', label: 'Viagem em família' },
 { value: 'custom', label: 'Personalizado…' }
 ],
 it: [
 { value: 'fiesta', label: 'Festa & vita notturna' },
 { value: 'monumentos', label: 'Monumenti & cultura' },
 { value: 'escapada', label: 'Fuga mentale' },
 { value: 'naturaleza', label: 'Natura & avventura' },
 { value: 'gastronomia', label: 'Gastronomia' },
 { value: 'familiar', label: 'Viaggio in famiglia' },
 { value: 'custom', label: 'Personalizzato…' }
 ],
};

const SEASONS_BY_LANG = {
 es: [{ value: 'primavera', label: 'Primavera' }, { value: 'verano', label: 'Verano' }, { value: 'otono', label: 'Otoño' }, { value: 'invierno', label: 'Invierno' }],
 en: [{ value: 'primavera', label: 'Spring' }, { value: 'verano', label: 'Summer' }, { value: 'otono', label: 'Autumn' }, { value: 'invierno', label: 'Winter' }],
 fr: [{ value: 'primavera', label: 'Printemps' }, { value: 'verano', label: 'Été' }, { value: 'otono', label: 'Automne' }, { value: 'invierno', label: 'Hiver' }],
 de: [{ value: 'primavera', label: 'Frühling' }, { value: 'verano', label: 'Sommer' }, { value: 'otono', label: 'Herbst' }, { value: 'invierno', label: 'Winter' }],
 pt: [{ value: 'primavera', label: 'Primavera' }, { value: 'verano', label: 'Verão' }, { value: 'otono', label: 'Outono' }, { value: 'invierno', label: 'Inverno' }],
 it: [{ value: 'primavera', label: 'Primavera' }, { value: 'verano', label: 'Estate' }, { value: 'otono', label: 'Autunno' }, { value: 'invierno', label: 'Inverno' }],
};

const REGIONS_BY_LANG = {
 es: [
 { value: 'cualquiera', label: 'Cualquier parte del mundo' }, { value: 'europa', label: 'Europa' }, { value: 'asia', label: 'Asia' },
 { value: 'america_norte', label: 'América del Norte' }, { value: 'america_sur', label: 'América del Sur' },
 { value: 'america_centro', label: 'América Central y Caribe' }, { value: 'africa', label: 'África' },
 { value: 'oceania', label: 'Oceanía' }, { value: 'espana', label: 'Dentro de España' }
 ],
 en: [
 { value: 'cualquiera', label: 'Anywhere in the world' }, { value: 'europa', label: 'Europe' }, { value: 'asia', label: 'Asia' },
 { value: 'america_norte', label: 'North America' }, { value: 'america_sur', label: 'South America' },
 { value: 'america_centro', label: 'Central America & Caribbean' }, { value: 'africa', label: 'Africa' },
 { value: 'oceania', label: 'Oceania' }, { value: 'espana', label: 'Within Spain' }
 ],
 fr: [
 { value: 'cualquiera', label: "N'importe où dans le monde"}, { value: 'europa', label: 'Europe' }, { value: 'asia', label: 'Asie' },
 { value: 'america_norte', label: 'Amérique du Nord' }, { value: 'america_sur', label: 'Amérique du Sud' },
 { value: 'america_centro', label: 'Amérique centrale & Caraïbes' }, { value: 'africa', label: 'Afrique' },
 { value: 'oceania', label: 'Océanie' }, { value: 'espana', label: 'En Espagne' }
 ],
 de: [
 { value: 'cualquiera', label: 'Irgendwo auf der Welt' }, { value: 'europa', label: 'Europa' }, { value: 'asia', label: 'Asien' },
 { value: 'america_norte', label: 'Nordamerika' }, { value: 'america_sur', label: 'Südamerika' },
 { value: 'america_centro', label: 'Mittelamerika & Karibik' }, { value: 'africa', label: 'Afrika' },
 { value: 'oceania', label: 'Ozeanien' }, { value: 'espana', label: 'Innerhalb Spaniens' }
 ],
 pt: [
 { value: 'cualquiera', label: 'Qualquer parte do mundo' }, { value: 'europa', label: 'Europa' }, { value: 'asia', label: 'Ásia' },
 { value: 'america_norte', label: 'América do Norte' }, { value: 'america_sur', label: 'América do Sul' },
 { value: 'america_centro', label: 'América Central e Caribe' }, { value: 'africa', label: 'África' },
 { value: 'oceania', label: 'Oceânia' }, { value: 'espana', label: 'Dentro de Espanha' }
 ],
 it: [
 { value: 'cualquiera', label: 'Ovunque nel mondo' }, { value: 'europa', label: 'Europa' }, { value: 'asia', label: 'Asia' },
 { value: 'america_norte', label: 'America del Nord' }, { value: 'america_sur', label: 'America del Sud' },
 { value: 'america_centro', label: 'America Centrale & Caraibi' }, { value: 'africa', label: 'Africa' },
 { value: 'oceania', label: 'Oceania' }, { value: 'espana', label: "All'interno della Spagna"}
 ],
};

const DAY_PRESETS_BY_LANG = {
 es: [{ days: 2, label: 'Fin de semana' }, { days: 4, label: 'Escapada' }, { days: 7, label: '1 Semana' }, { days: 10, label: '10 Días' }, { days: 14, label: '2 Semanas' }],
 en: [{ days: 2, label: 'Weekend' }, { days: 4, label: 'Getaway' }, { days: 7, label: '1 Week' }, { days: 10, label: '10 Days' }, { days: 14, label: '2 Weeks' }],
 fr: [{ days: 2, label: 'Week-end' }, { days: 4, label: 'Escapade' }, { days: 7, label: '1 Semaine' }, { days: 10, label: '10 Jours' }, { days: 14, label: '2 Semaines' }],
 de: [{ days: 2, label: 'Wochenende' }, { days: 4, label: 'Kurztrip' }, { days: 7, label: '1 Woche' }, { days: 10, label: '10 Tage' }, { days: 14, label: '2 Wochen' }],
 pt: [{ days: 2, label: 'Fim de semana' }, { days: 4, label: 'Escapadela' }, { days: 7, label: '1 Semana' }, { days: 10, label: '10 Dias' }, { days: 14, label: '2 Semanas' }],
 it: [{ days: 2, label: 'Fine settimana' }, { days: 4, label: 'Gita' }, { days: 7, label: '1 Settimana' }, { days: 10, label: '10 Giorni' }, { days: 14, label: '2 Settimane' }],
};

const SEASON_LABELS = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno' };

const PROPOSAL_LABELS_BY_LANG = {
 es: [{ label: 'Clásico', emoji: '', desc: 'Popular y probado' }, { label: 'Alternativo', emoji: '', desc: 'Joya oculta' }, { label: 'Exótico', emoji: '', desc: 'Fuera de lo común' }],
 en: [{ label: 'Classic', emoji: '', desc: 'Popular and proven' }, { label: 'Alternative', emoji: '', desc: 'Hidden gem' }, { label: 'Exotic', emoji: '', desc: 'Off the beaten path' }],
 fr: [{ label: 'Classique', emoji: '', desc: 'Populaire et éprouvé' }, { label: 'Alternatif', emoji: '', desc: 'Perle cachée' }, { label: 'Exotique', emoji: '', desc: 'Hors des sentiers battus' }],
 de: [{ label: 'Klassisch', emoji: '', desc: 'Beliebt und bewährt' }, { label: 'Alternativ', emoji: '', desc: 'Verborgenes Juwel' }, { label: 'Exotisch', emoji: '', desc: 'Abseits der Touristenpfade' }],
 pt: [{ label: 'Clássico', emoji: '', desc: 'Popular e comprovado' }, { label: 'Alternativo', emoji: '', desc: 'Joia escondida' }, { label: 'Exótico', emoji: '', desc: 'Fora do comum' }],
 it: [{ label: 'Classico', emoji: '', desc: 'Popolare e collaudato' }, { label: 'Alternativo', emoji: '', desc: 'Gemma nascosta' }, { label: 'Esotico', emoji: '', desc: 'Fuori dai sentieri battuti' }],
};

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
 <span className="star-rating"title={`${score.toFixed(1)} / ${max}`}>
 <span className="stars-empty">★★★★★</span>
 <span className="stars-filled"style={{ width: `${pct}%` }}>★★★★★</span>
 </span>
 );
};

// ─── Restaurant Card ───────────────────────────────────────────────────────────────────

const TYPE_EMOJI = {
 restaurant: '', cafe: '☕', bar: '🍺', pub: '🍻',
 bistro: '🥘', fast_food: '🍔', default: ''
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
 {r.stars >0 && (
 <div className="restaurant-rating">
 <StarRating score={r.stars} />
 <span className="restaurant-score">{r.stars.toFixed(1)}</span>
 </div>
 )}
 </div>
 {r.address && <div className="restaurant-address"> {r.address}</div>}
 {r.opening_hours && (
 <div className="restaurant-hours">
 ⏰ <span>{r.opening_hours.split(';')[0]}</span>
 </div>
 )}
 <div className="restaurant-actions">
 <a href={mapsUrl} target="_blank"rel="noopener noreferrer"className="restaurant-maps-btn">
 Ver en Maps →
 </a>
 {r.website && (
 <a href={r.website} target="_blank"rel="noopener noreferrer"className="restaurant-web-btn">
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
 html: `<div class="map-marker-restaurant" style="display:flex;align-items:center;justify-content:center;font-size:16px;">🍽️</div>`,
 iconSize: [32, 32],
 iconAnchor: [16, 16],
 popupAnchor: [0, -16],
});

const DayMap = ({ activities, restaurants, destination, lodgings }) => {
 const mapContainerRef = useRef(null);
 const mapInstanceRef = useRef(null);
 const layerGroupRef = useRef(null);

 // Initialise map once
 useEffect(() => {
 if (!mapContainerRef.current || mapInstanceRef.current) return;
 const map = L.map(mapContainerRef.current, {
 center: [40.4168, -3.7038], zoom: 13,
 zoomControl: true, scrollWheelZoom: false
 });
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
 attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>contributors',
 maxZoom: 19
 }).addTo(map);
 mapInstanceRef.current = map;
 layerGroupRef.current = L.layerGroup().addTo(map);
 // CRITICAL: force Leaflet to recalculate size once the container is visible in DOM
 setTimeout(() =>map.invalidateSize(), 100);
 return () => { map.remove(); mapInstanceRef.current = null; };
 }, []);

 // Also invalidate size whenever activities change (tab switch may hide/show the container)
 useEffect(() => {
 const timer = setTimeout(() =>mapInstanceRef.current?.invalidateSize(), 80);
 return () =>clearTimeout(timer);
 }, [activities]);

 // Update markers & route when activities/restaurants change
 useEffect(() => {
 const map = mapInstanceRef.current;
 const lg = layerGroupRef.current;
 if (!map || !lg) return;
 lg.clearLayers();

 const validActs = (activities || []).filter(a =>a._lat && a._lng);
 const validRest = (restaurants || []).filter(r =>r.lat && r.lng);

 // Activity markers
 validActs.forEach((act, i) => {
 const marker = L.marker([act._lat, act._lng], { icon: createNumberedIcon(i + 1) })
 .bindPopup(`<strong>${i + 1}. ${act.name}</strong>${act.price ? `<br><span class='map-popup-price'>${act.price}</span>` : ''}`);
 lg.addLayer(marker);
 });

 // Restaurant markers
 validRest.forEach(r => {
 const marker = L.marker([r.lat, r.lng], { icon: restaurantIcon })
 .bindPopup(`<strong>${r.name}</strong>${r.cuisine ? `<br>${r.cuisine.replace(/_/g,' ')}` : ''}${r.stars >0 ? `<br>★ ${r.stars.toFixed(1)}` : ''}`);
 lg.addLayer(marker);
 });

 
    const validLodgings = (lodgings || []).filter(l => l._lat && l._lng && l._lat !== 'notfound');

    // Lodging markers
    validLodgings.forEach((l, i) => {
      const lodgingIcon = L.divIcon({
        className: '',
        html: `<div class="map-marker-restaurant" style="background:var(--accent-indigo);display:flex;align-items:center;justify-content:center;font-size:16px;color:white;">🛏️</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
      const marker = L.marker([l._lat, l._lng], { icon: lodgingIcon })
        .bindPopup(`<strong>🛏️ ${l.name}</strong>${l.price_range ? `<br>${l.price_range}` : ''}`);
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
 ...validRest.map(r => [r.lat, r.lng]),
        ...validLodgings.map(l => [l._lat, l._lng])
 ];
 map.fitBounds(L.latLngBounds(allPoints).pad(0.15));
 } else if (validActs.length === 1) {
 map.setView([validActs[0]._lat, validActs[0]._lng], 14);
 }
 }, [activities, restaurants, lodgings]);

 return (
 <div className="day-map-wrapper">
 <div ref={mapContainerRef} className="day-map-container"/>
 <div className="map-legend">
 <span className="legend-item"><span className="legend-dot legend-activity">1</span>Activity</span>
 <span className="legend-item"><span className="legend-rest"></span>Restaurant</span>
 <span className="legend-item"><span className="legend-line"/>Route</span>
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
 <a href={act.url} target="_blank"rel="noopener noreferrer"className="act-url">
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
 <a href={lodging.url} target="_blank"rel="noopener noreferrer"className="lodging-url-btn">
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
 const [detailTab, setDetailTab] = useState('chat');
 const [sidebarExpanded, setSidebarExpanded] = useState(true);
 const [language, setLanguage] = useState(() => {
 try { return localStorage.getItem('trIAvel_lang') || 'es'; } catch { return 'es'; }
 });

 // i18n helper
 const t = (key) => (TRANSLATIONS[language] || TRANSLATIONS.es)[key] || key;
 const TRAVEL_TYPES = TRAVEL_TYPES_BY_LANG[language] || TRAVEL_TYPES_BY_LANG.es;
 const SEASONS = SEASONS_BY_LANG[language] || SEASONS_BY_LANG.es;
 const REGIONS = REGIONS_BY_LANG[language] || REGIONS_BY_LANG.es;
 const DAY_PRESETS = DAY_PRESETS_BY_LANG[language] || DAY_PRESETS_BY_LANG.es;
 const PROPOSAL_LABELS = PROPOSAL_LABELS_BY_LANG[language] || PROPOSAL_LABELS_BY_LANG.es;
 const LOADING_STEPS = [
 { text: t('loading0') }, { text: t('loading1') }, { text: t('loading2') }, { text: t('loading3') }
 ];

 const handleSetLanguage = (code) => {
 setLanguage(code);
 try { localStorage.setItem('trIAvel_lang', code); } catch {}
 };

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
 const [savedPlans, setSavedPlans] = useState(() => { try { return JSON.parse(localStorage.getItem('trIAvel_saved_plans') || '[]'); } catch { return []; } });
 const [historyLoading, setHistoryLoading] = useState(false);
 const [planLoading, setPlanLoading] = useState(false);
 const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null);
 const [historyOriginGroup, setHistoryOriginGroup] = useState(null);

 // Map & restaurants state
 const [activeDayIndex, setActiveDayIndex] = useState(0);
 const [geoActivities, setGeoActivities] = useState([]);
  const [geoLodgings, setGeoLodgings] = useState([]);
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

 const toggleTheme = () =>setTheme(t =>t === 'dark' ? 'light' : 'dark');

 // Scroll to results when proposal is selected
 useEffect(() => {
 if (selectedProposal) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
 }, [selectedProposal]);

 // Loading step animation
 useEffect(() => {
 if (loading) {
 setLoadingStep(0);
 intervalRef.current = setInterval(() =>setLoadingStep(p => (p + 1) % LOADING_STEPS.length), 1800);
 } else {
 clearInterval(intervalRef.current);
 }
 return () =>clearInterval(intervalRef.current);
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
 newTypes = newTypes.filter(v =>v !== value);
 if (newTypes.length === 0) newTypes = ['monumentos'];
 } else {
 newTypes.push(value);
 }
 setTravelType(newTypes);
 };

 const effectiveTravelType = travelType.map(tv => 
 tv === 'custom' ? customType.trim() : TRAVEL_TYPES.find(tt =>tt.value === tv)?.label || tv
 ).filter(tv =>tv).join(' o ');

 const currentSeason = SEASONS.find(s =>s.value === season);

 const toggleRegion = (value) => {
 if (value === 'cualquiera') {
 setRegions(['cualquiera']);
 } else {
 let newRegions = regions.filter(r =>r !== 'cualquiera');
 if (newRegions.includes(value)) {
 newRegions = newRegions.filter(r =>r !== value);
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
 setActiveTab('destination_detail');
 setDetailTab('chat');
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
 setImgErrors({});
 setChatHistory([]);

 try {
 const selectedRegionLabels = regions.includes('cualquiera')
 ? 'Cualquier parte del mundo'
 : regions.map(v =>REGIONS.find(r =>r.value === v)?.label).join(' o ');

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
 setActiveDayIndex(0);
 setGeoActivities([]);
 setDayRestaurants([]);
 
 const pid = proposal.planId || proposal.id;
 if (pid && !savedPlans.includes(pid)) {
 const newSaved = [...savedPlans, pid];
 setSavedPlans(newSaved);
 localStorage.setItem('trIAvel_saved_plans', JSON.stringify(newSaved));
 }
 
 setActiveTab('history');
 if (window.innerWidth <= 768) setSidebarExpanded(false);
 };

 // ─── Load map data for a day ─────────────────────────────────────────────────────────

 const loadDayMap = useCallback(async (dayPlan, destination, country, rating, lodging) => {
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
 await new Promise(r =>setTimeout(r, 350));
 }
 setGeoActivities(geoResults);

 // 2. Find centroid of valid points for restaurant search
 const validPoints = geoResults.filter(a =>a._lat && a._lng);
 let avgLat, avgLng, radius = 600;
 
 if (validPoints.length >0) {
 avgLat = validPoints.reduce((s, a) =>s + a._lat, 0) / validPoints.length;
 avgLng = validPoints.reduce((s, a) =>s + a._lng, 0) / validPoints.length;
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

 // 3. Geocode lodgings
    if (lodging && Array.isArray(lodging)) {
      const city = [destination, country].filter(Boolean).join(', ');
      for (let i = 0; i < lodging.length; i++) {
        if (!lodging[i]._lat) {
          try {
            const lName = encodeURIComponent(lodging[i].name);
            const lCity = encodeURIComponent(city);
            const res = await axios.get(`http://localhost:${import.meta.env.VITE_BACKEND_PORT || 4000}/api/geocode?query=${lName}, ${lCity}`);
            if (res.data && res.data.length > 0) {
              lodging[i]._lat = parseFloat(res.data[0].lat);
              lodging[i]._lng = parseFloat(res.data[0].lon);
            } else {
               lodging[i]._lat = 'notfound';
            }
          } catch(e) {}
          await new Promise(r => setTimeout(r, 350));
        }
      }
      setGeoLodgings([...lodging]);
    } else {
      setGeoLodgings([]);
    }

 setMapLoading(false);
 }, []);

 // Auto-load map when selectedProposal changes (first day) or when browsing proposals in modal
 useEffect(() => {
 if (activeTab === 'proposals' && proposals[activeProposal]?.plan?.length >0) {
 setActiveDayIndex(0);
 loadDayMap(proposals[activeProposal].plan[0], proposals[activeProposal].destination, proposals[activeProposal].country, minRating, proposals[activeProposal].lodging);
 } else if (activeTab === 'destination_detail' && selectedProposal?.plan?.length >0) {
 loadDayMap(selectedProposal.plan[0], selectedProposal.destination, selectedProposal.country, minRating, selectedProposal.lodging);
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedProposal, activeTab, activeProposal]);

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

 const visibleChat = chatHistory.filter(m =>m.role !== 'system');

 // ─── Modal navigation ──────────────────────────────────────────────────────

 const goNext = () =>setActiveProposal(p => (p + 1) % proposals.length);
 const goPrev = () =>setActiveProposal(p => (p - 1 + proposals.length) % proposals.length);

 const currentProposal = proposals[activeProposal];

 // ─── Render ────────────────────────────────────────────────────────────────

 const renderDayPlanUI = (targetProposal, isModal = false) => {
 if (!targetProposal || !Array.isArray(targetProposal.plan) || targetProposal.plan.length === 0) return null;
 return (
 <div className={isModal ? "modal-section": "result-section"}>
 <div className="plan-section-header">
 <h3 style={{ margin: 0 }} className={isModal ? "modal-section-title": ""}>{t('travelPlan')}</h3>
 <div className="map-rating-filter">
 <label className="map-filter-label">
 {t('minStars')}
 <select
 value={minRating}
 onChange={e => {
 const r = parseFloat(e.target.value);
 setMinRating(r);
 if (targetProposal?.plan?.[activeDayIndex]) {
 loadDayMap(targetProposal.plan[activeDayIndex], targetProposal.destination, targetProposal.country, r, targetProposal.lodging);
 }
 }}
 className="map-filter-select"
 >
 <option value={0}>{t('allStars')}</option>
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
 loadDayMap(dayPlan, targetProposal.destination, targetProposal.country, minRating, targetProposal.lodging);
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
 <div className="day-detail-panel"key={activeDayIndex}>
 {/* Map */}
 <div className="day-map-section">
 {mapLoading && (
 <div className="map-loading-overlay">
 <span className="spinner"style={{ borderTopColor: 'var(--accent-indigo)' }} />
 <span>{t('geocoding')}</span>
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
 <li key={i} className="act-item-rich"style={{ listStyle: 'none' }}>
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
 <a href={act.url} target="_blank"rel="noopener noreferrer"className="act-url">
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
 {t('nearbyFood')}
 {mapLoading && <span className="rest-loading-tag">{t('searching')}</span>}
 {!mapLoading && dayRestaurants.length === 0 && geoActivities.length >0 && (
 <span className="rest-empty-tag">{t('noResults')}</span>
 )}
 </div>
 {dayRestaurants.length >0 && (
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
          <div className="sidebar-logo" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
            <span className="sidebar-logo-icon">🗺️</span>
            {sidebarExpanded && <span className="sidebar-logo-text">trIAvel</span>}
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
            {sidebarExpanded && <span className="sidebar-nav-text">{t('navHome')}</span>}
          </button>
          
          {proposals.length > 0 && (
          <button 
            className={`sidebar-nav-btn ${activeTab === 'proposals' ? 'active' : ''}`}
            onClick={() => { setActiveTab('proposals'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">💡</span>
            {sidebarExpanded && <span className="sidebar-nav-text">{t('navProposals')}</span>}
            {sidebarExpanded && <span className="sidebar-nav-badge">3</span>}
          </button>
          )}

          <button 
            className={`sidebar-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">📚</span>
            {sidebarExpanded && <span className="sidebar-nav-text">{t('navSaved')}</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'all_history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('all_history'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">🕰️</span>
            {sidebarExpanded && <span className="sidebar-nav-text">{t('navHistory')}</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'solutions' ? 'active' : ''}`}
            onClick={() => { setActiveTab('solutions'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">📘</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Soluciones</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'wip-recursos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wip-recursos'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">📦</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Recursos</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'wip-comunidad' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wip-comunidad'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">👥</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Comunidad</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'wip-empresa' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wip-empresa'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">🏢</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Empresa</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'wip-precios' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wip-precios'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">💰</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Precios</span>}
          </button>

          <button 
            className={`sidebar-nav-btn ${activeTab === 'wip-seguridad' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wip-seguridad'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon">🔒</span>
            {sidebarExpanded && <span className="sidebar-nav-text">Seguridad</span>}
          </button>

          <button
            className={`sidebar-nav-btn ${activeTab === 'language' ? 'active' : ''}`}
            onClick={() => { setActiveTab('language'); if(window.innerWidth <= 768) setSidebarExpanded(false); }}
          >
            <span className="sidebar-nav-icon lang-flag-icon">
              {LANGUAGES.find(l => l.code === language)?.flag || '🌍'}
            </span>
            {sidebarExpanded && <span className="sidebar-nav-text">{t('navLanguage')}</span>}
            {sidebarExpanded && (
              <span className="sidebar-lang-badge">
                {language.toUpperCase()}
              </span>
            )}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-nav-btn theme-toggle" onClick={toggleTheme}>
            <span className="sidebar-nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {sidebarExpanded && <span className="sidebar-nav-text">{theme === 'dark' ? t('themeLight') : t('themeDark')}</span>}
          </button>
        </div>
      </aside>



 {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
 <main className="dashboard-main-content">
 {activeTab === 'language' && (
 <div className="dashboard-view language-view"style={{ maxWidth: '700px', margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: '32px 24px' }}>
 <div className="lang-panel-header">
 <div className="lang-panel-globe"></div>
 <div>
 <h2 className="lang-panel-title">{t('langTabTitle')}</h2>
 <p className="lang-panel-desc">{t('langTabDesc')}</p>
 </div>
 </div>
 <div className="lang-grid">
 {LANGUAGES.map(lang => (
 <button
 key={lang.code}
 className={`lang-card ${language === lang.code ? 'active' : ''}`}
 onClick={() =>handleSetLanguage(lang.code)}
 id={`lang-btn-${lang.code}`}
 >
 <span className="lang-card-flag">{lang.flag}</span>
 <span className="lang-card-name">{lang.nativeName}</span>
 {language === lang.code && <span className="lang-card-check">✓</span>}
 </button>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'home' && (
 <div className="dashboard-view home-view"style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px 0', overflowY: 'auto' }}>
 <header>
 
 <h1>{t('appName')}</h1>
 <p className="subtitle">
 {t('subtitle')}
 </p>
 </header>
 <section className="card"id="travel-form">
 <div className="card-header">
 <h2>{t('formTitle')}</h2>
 </div>

 <div className="form-grid">
 <div className="form-group">
 <label className="form-label"htmlFor="season-select">{t('season')}</label>
 <select id="season-select"value={season} onChange={e =>setSeason(e.target.value)}>
 {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
 </select>
 </div>

 <div className="form-group">
 <label className="form-label"htmlFor="budget-input">{t('budget')}</label>
 <div className="budget-wrapper">
 <input
 id="budget-input"type="number"min="0"step="50"
 value={budget} onChange={e =>setBudget(e.target.value)} placeholder="Ej. 1200"
 />
 <span className="currency-symbol">€</span>
 </div>
 </div>
 </div>

 {/* Multi-selector de enfoques */}
 <div className="travel-types-section"style={{ marginTop: '20px', marginBottom: '20px' }}>
 <span className="form-label"style={{ marginBottom: '12px', display: 'block' }}>{t('travelFocus')}</span>
 <div className="regions-grid"style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
 {TRAVEL_TYPES.map(tt => {
 const isActive = travelType.includes(tt.value);
 return (
 <button
 key={tt.value}
 type="button"
 className={`day-preset-btn ${isActive ? 'active' : ''}`}
 onClick={() =>toggleTravelType(tt.value)}
 style={{ minWidth: 'auto', padding: '10px 16px' }}
 >
 <span className="preset-label">{tt.label}</span>
 </button>
 );
 })}
 </div>
 </div>

 {travelType.includes('custom') && (
 <div className="form-group custom-input-group">
 <label className="form-label"htmlFor="custom-type-input">{t('customLabel')}</label>
 <input
 id="custom-type-input"type="text"value={customType}
 onChange={e =>setCustomType(e.target.value)}
 placeholder={t('customPlaceholder')}
 />
 </div>
 )}

 {/* Multi-selector de regiones */}
 <div className="regions-section"style={{ marginTop: '20px', marginBottom: '20px' }}>
 <span className="form-label"style={{ marginBottom: '12px', display: 'block' }}>{t('whereGo')}</span>
 <div className="regions-grid"style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
 {REGIONS.map(r => {
 const isActive = regions.includes(r.value);
 return (
 <button
 key={r.value}
 type="button"
 className={`day-preset-btn ${isActive ? 'active' : ''}`}
 onClick={() =>toggleRegion(r.value)}
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
 <span className="form-label">{t('duration')}</span>
 <div className="days-presets">
 {DAY_PRESETS.map(p => (
 <button
 key={p.days} type="button"
 className={`day-preset-btn${days === p.days ? ' active' : ''}`}
 onClick={() =>setDays(p.days)}
 >
 <span className="preset-label">{p.label}</span>
 <span className="preset-days">{p.days}d</span>
 </button>
 ))}
 </div>
 <div className="days-custom">
 <span className="days-custom-label">{t('orChoose')}</span>
 <div className="days-stepper">
 <button type="button"className="stepper-btn"onClick={() =>setDays(d =>Math.max(1, d - 1))} aria-label="-">−</button>
 <span className="days-value">{days} {days === 1 ? t('day') : t('days')}</span>
 <button type="button"className="stepper-btn"onClick={() =>setDays(d =>Math.min(30, d + 1))} aria-label="+">+</button>
 </div>
 </div>
 </div>

 <button className="btn-primary"onClick={handleGenerate} disabled={loading} id="generate-btn">
 <span>
 {loading && <span className="spinner"/>}
 {loading ? t('generatingBtn') : t('generateBtn')}
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

 <footer>
 <div className="footer-divider"/>
 <p>{t('footer')}</p>
 </footer>
 </div>
 )}

 
 {activeTab === 'destination_detail' && selectedProposal && (
 <div className="dashboard-view destination-detail-view"style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px 0' }}>
 <div className="detail-header"style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
 <button 
 className="btn-secondary"
 onClick={() => {
 if (historyOriginGroup) {
 setSelectedHistoryGroup(historyOriginGroup);
 setHistoryOriginGroup(null);
 }
 setActiveTab('history');
 }}
 >
 ⬅ Volver a Guardados
 </button>
 <div className="detail-tabs">
 <button 
 className={`detail-tab-btn ${detailTab === 'chat' ? 'active' : ''}`}
 onClick={() =>setDetailTab('chat')}
 >
 Chat
 </button>
 <button 
 className={`detail-tab-btn ${detailTab === 'info' ? 'active' : ''}`}
 onClick={() =>setDetailTab('info')}
 >
 Información del destino
 </button>
 </div>
 </div>

 {detailTab === 'info' && (
 <section className="card card-delay-1"id="travel-results"ref={resultRef}>

 {/* Selected proposal header */}
 <div className="selected-proposal-header">
 <div className="selected-label">{t('yourDestination')}</div>
 <button
 className="change-proposal-btn"
 onClick={() =>setActiveTab('proposals')}
 id="change-proposal-btn"
 >
 {t('changeDestination')}
 </button>
 </div>

 {/* Imagen hero */}
 {selectedProposal.image && !imgErrors['selected'] ? (
 <div className="destination-image-wrapper">
 <img
 src={selectedProposal.image} alt={`${selectedProposal.destination}, ${selectedProposal.country}`}
 className="destination-image"onError={() =>setImgErrors(prev => ({ ...prev, selected: true }))}
 />
 <div className="destination-image-overlay"/>
 <div className="destination-image-title">
 <h2 className="destination-name-hero">{selectedProposal.destination}</h2>
 {selectedProposal.country && <span className="destination-country-hero">{selectedProposal.country}</span>}
 </div>
 </div>
 ) : (
 <div className="card-header">
 <div className="card-header-icon"></div>
 <h2>{t('recommended')}</h2>
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
 <span className="badge badge-days">{days} {days === 1 ? t('day') : t('days')}</span>
 {selectedProposal.planId && <span className="badge badge-saved">{t('saved')}</span>}
 </div>

 {selectedProposal.why && (
 <div className="why-block">
 <div className="why-icon"></div>
 <div>
 <strong>{t('whyTitle')}</strong>
 <p>{selectedProposal.why}</p>
 </div>
 </div>
 )}

 {/* Plan de días con mapa */}
 {renderDayPlanUI(selectedProposal, false)}

 {/* Hospedaje */}
 {selectedProposal.lodging && (
 <div className="result-section">
 <h3>{t('lodgingTitle')}</h3>
 <LodgingSection lodging={selectedProposal.lodging} />
 </div>
 )}

 {/* Viajes similares */}
 {selectedProposal.similarTrips?.length >0 && (
 <div className="result-section similar-trips-section">
 <h3>{t('similarTrips')}</h3>
 <div className="similar-trips-grid">
 {selectedProposal.similarTrips.map(trip => (
 <button
 key={trip.id}
 className="similar-trip-card"
 onClick={() =>loadPlanFromHistory(trip.id)}
 disabled={planLoading}
 >
 {trip.imageUrl ? (
 <img src={trip.imageUrl} alt={trip.destination} className="similar-trip-img"/>
 ) : (
 <div className="similar-trip-img similar-trip-img-placeholder"></div>
 )}
 <div className="similar-trip-info">
 <div className="similar-trip-dest">{trip.destination}</div>
 <div className="similar-trip-meta">
 <span>{trip.travelType}</span>
 <span>{SEASON_LABELS[trip.season] || trip.season}</span>
 </div>
 <div className="similar-trip-date">{formatDate(trip.createdAt)}</div>
 </div>
 <div className="similar-trip-action">{t('viewTrip')}</div>
 </button>
 ))}
 </div>
 </div>
 )}
 </section>
 )}
 {detailTab === 'chat' && (
 <section className="card card-delay-2"id="travel-chat"style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 0, overflow: 'hidden', minHeight: 0, marginBottom: '20px' }}>
 <div className="card-header">
 <div className="card-header-icon"></div>
 <h2>{t('chatTitle')}</h2>
 {selectedProposal.planId && <span className="chat-memory-badge">{t('chatWithMemory')}</span>}
 </div>

 <div className="chat-window">
 {visibleChat.length === 0 && !chatLoading && (
 <div className="chat-empty">
 <span className="chat-empty-icon"></span>
 <span>{t('chatEmpty')}</span>
 </div>
 )}

 {visibleChat.map((msg, idx) => (
 <div key={idx} className={`chat-bubble ${msg.role}`}>
 <div className="chat-avatar">{msg.role === 'assistant' ? '' : ''}</div>
 <div className="chat-content">
 {msg.role === 'assistant'
 ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
 : msg.content}
 </div>
 </div>
 ))}

 {chatLoading && (
 <div className="typing-indicator">
 <div className="chat-avatar assistant-avatar"></div>
 <div className="typing-dots"><span /><span /><span /></div>
 </div>
 )}

 <div ref={chatEndRef} />
 </div>

 <form onSubmit={handleChatSubmit} className="chat-form">
 <input
 id="chat-input"type="text"value={chatInput}
 onChange={e =>setChatInput(e.target.value)}
 placeholder={t('chatPlaceholder')}
 />
 <button
 type="submit"className="btn-send"
 disabled={chatLoading || !chatInput.trim()} id="chat-send-btn"aria-label={t('chatSend')}
 >➤</button>
 </form>
 </section>
 )}
 
 <footer style={{ flexShrink: 0 }}>
 <div className="footer-divider"/>
 <p>trIAvel · Impulsado por inteligencia artificial</p>
 </footer>
 </div>
 )}
{activeTab === 'proposals' && proposals.length >0 && (
 <div 
 className="dashboard-view proposals-view"
 onClick={() => {
 if (historyOriginGroup) {
 setProposals([]);
 setSelectedHistoryGroup(historyOriginGroup);
 setHistoryOriginGroup(null);
 setActiveTab('history');
 } else {
 setActiveTab('home');
 }
 }}
 style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', boxSizing: 'border-box' }}
 >
 <div 
 className="proposals-view-container"
 style={{ padding: "0", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box", cursor: 'default', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
 onClick={(e) =>e.stopPropagation()}
 >
 <div className="dashboard-proposals-header">
 <div className="modal-header-left"style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
 <button 
 className="history-btn"
 style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'transparent' }}
 onClick={() => {
 if (historyOriginGroup) {
 setProposals([]);
 setSelectedHistoryGroup(historyOriginGroup);
 setHistoryOriginGroup(null);
 setActiveTab('history');
 } else {
 setActiveTab('home');
 }
 }}
 >
 ⬅ {historyOriginGroup ? `${t('backTo')} ${historyOriginGroup}` : `${t('backTo')} ${t('navHome')}`}
 </button>
 <span className="modal-title-icon"></span>
 <div>
 <h2 className="modal-title">{t('proposalsTitle')}</h2>
 <p className="modal-subtitle">{currentSeason?.label} · {budget}€ · {effectiveTravelType} · {days} {days === 1 ? t('day') : t('days')}</p>
 </div>
 </div>
 
 </div>

 {/* Proposal Tabs */}
 <div className="proposal-tabs">
 {proposals.map((p, i) => (
 <button
 key={i}
 className={`proposal-tab${activeProposal === i ? ' active' : ''}`}
 onClick={() =>setActiveProposal(i)}
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
 onError={() =>setImgErrors(prev => ({ ...prev, [activeProposal]: true }))}
 />
 <div className="modal-hero-overlay"/>
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
 <div className="why-icon"></div>
 <div>
 <strong>{t('whyTitle')}</strong>
 <p>{currentProposal.why}</p>
 </div>
 </div>
 )}

 {/* Plan preview */}
 {renderDayPlanUI(currentProposal, true)}

 {/* Lodging */}
 {currentProposal.lodging && (
 <div className="modal-section">
 <h4 className="modal-section-title">{t('lodgingTitle')}</h4>
 <LodgingSection lodging={currentProposal.lodging} />
 </div>
 )}

 {/* Navigation arrows + Select CTA */}
 <div className="modal-footer-actions">
 <div className="modal-nav-arrows">
 <button className="modal-nav-btn"onClick={goPrev} aria-label="Propuesta anterior">
 ‹
 </button>
 <span className="modal-nav-counter">{activeProposal + 1} / {proposals.length}</span>
 <button className="modal-nav-btn"onClick={goNext} aria-label="Propuesta siguiente">
 ›
 </button>
 </div>
 <button
 className="btn-select-proposal"
 onClick={() =>handleSelectProposal(currentProposal)}
 id={`select-proposal-${activeProposal}`}
 >
 <span>{t('chooseDestination')}</span>
 <span className="btn-select-arrow">→</span>
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {(activeTab === 'history' || activeTab === 'all_history') && (
 
 <div className="dashboard-view history-view"style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
 <h2>{activeTab === 'history' ? t('savedTitle') : t('historyTitle')}</h2>
 {selectedHistoryGroup && (
 <button className="btn-secondary"onClick={() =>setSelectedHistoryGroup(null)}>
 {t('backToGroups')}
 </button>
 )}
 </div>

 {!selectedHistoryGroup ? (
 <div className="history-groups-grid"style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
 {historyLoading ? (
 <div className="loading-spinner"><span className="spinner"></span></div>
 ) : (activeTab === 'history' ? historyPlans.filter(p =>savedPlans.includes(p.id)) : historyPlans).length === 0 ? (
 <p>{t('noSaved')}</p>
 ) : (
 Object.entries(
 (activeTab === 'history' ? historyPlans.filter(p =>savedPlans.includes(p.id)) : historyPlans).reduce((acc, plan) => {
 const type = plan.travelType || 'Otros';
 if (!acc[type]) acc[type] = [];
 acc[type].push(plan);
 return acc;
 }, {})
 ).map(([type, plans]) => (
 <button
 key={type}
 className="history-group-card card"
 onClick={() =>setSelectedHistoryGroup(type)}
 style={{ padding: '24px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
 >
 <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{type}</h3>
 <span className="badge badge-accent"style={{ background: 'var(--accent-indigo)', color: 'white', padding: '4px 12px', borderRadius: '20px' }}>
 {plans.length} {t('trips')}
 </span>
 </button>
 ))
 )}
 </div>
 ) : (
 <div className="previews-grid"style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
 {(activeTab === 'history' ? historyPlans.filter(p =>savedPlans.includes(p.id)) : historyPlans).filter(p => (p.travelType || 'Otros') === selectedHistoryGroup).map(plan => (
 <button
 key={plan.id}
 onClick={() =>loadPlanFromHistory(plan.id, selectedHistoryGroup)}
 disabled={planLoading}
 className="card previews-card"
 style={{ padding: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
 >
 {plan.imageUrl ? (
 <img src={plan.imageUrl} alt={plan.destination} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }} />
 ) : (
 <div style={{ width: '100%', height: '180px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', borderRadius: '8px', marginBottom: '12px' }}></div>
 )}
 <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{plan.destination}</h4>
 <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{plan.days} días · {formatDate(plan.createdAt)}</span>
 </button>
 ))}
 </div>
 )}
 </div>

 )}
 
        {activeTab === 'solutions' && (
          <div className="dashboard-view solutions-view" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100vh', padding: '48px 24px', overflowY: 'auto' }}>
            <h1 style={{fontSize:'2.5rem', marginBottom:'24px', color: 'var(--text-primary)'}}>Soluciones</h1>
            <p style={{fontSize:'1.1rem', color:'var(--text-secondary)', lineHeight:'1.6'}}>
              trIAvel es tu asistente personal de viajes impulsado por inteligencia artificial.
            </p>
            <div style={{marginTop:'40px', display:'flex', flexDirection:'column', gap:'24px'}}>
              <div className="card" style={{padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)'}}>
                <h3 style={{color: 'var(--text-primary)', marginBottom: '12px'}}>1. Generación de destinos</h3>
                <p style={{color: 'var(--text-secondary)', lineHeight: '1.5'}}>Nuestra IA analiza tus preferencias de temporada, presupuesto y estilo de viaje para encontrar los destinos que mejor encajan contigo, ofreciendo opciones desde clásicas hasta exóticas.</p>
              </div>
              <div className="card" style={{padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)'}}>
                <h3 style={{color: 'var(--text-primary)', marginBottom: '12px'}}>2. Planificación día a día</h3>
                <p style={{color: 'var(--text-secondary)', lineHeight: '1.5'}}>Una vez elegido el destino, generamos un itinerario detallado con actividades, horarios y recomendaciones gastronómicas, todo trazado en un mapa interactivo para optimizar tus desplazamientos.</p>
              </div>
              <div className="card" style={{padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)'}}>
                <h3 style={{color: 'var(--text-primary)', marginBottom: '12px'}}>3. Asistente inteligente</h3>
                <p style={{color: 'var(--text-secondary)', lineHeight: '1.5'}}>Tienes a tu disposición un chat integrado con memoria contextual. Puedes pedir cambios en tu ruta, buscar alternativas o resolver dudas sobre tu próximo viaje sin salir de la plataforma.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab.startsWith('wip') && (
          <div className="dashboard-view wip-view" style={{ maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100vh', padding: '100px 24px', alignItems:'center', textAlign:'center', justifyContent: 'center' }}>
            <h1 style={{fontSize:'3rem', marginBottom:'24px', color:'var(--accent-indigo)'}}>Estamos trabajando en ello...</h1>
            <p style={{fontSize:'1.2rem', color:'var(--text-secondary)'}}>Esta sección estará disponible próximamente en futuras actualizaciones.</p>
          </div>
        )}

</main>
 </div>
 );
}
export default App;
