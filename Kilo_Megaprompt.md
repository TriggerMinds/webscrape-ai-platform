Je bent Kilo, een autonome AI-ontwikkelaar. Jouw taak is om een complete, productie-klare data-extractie en AI orkestratie pijplijn te bouwen die de functionaliteit van Firecrawl, Octoparse en Gumloop vervangt.

Lees **eerst** het bestand `AGENTS.md` in de root van dit project. Hierin staan de strikte architecturale beslissingen, de gekozen stack (n8n, Crawlee/Playwright, Turndown, PostgreSQL) en de productie-eisen, waaronder het Hysteria proxy-protocol. Wijk hier niet van af.

Implementeer dit project via de volgende fases. Stop na elke fase voor mijn review voordat je verder gaat.

### Phase 1: Project Setup & Microservice Fundering
1. Genereer een `docker-compose.yml` die n8n (met environment variabelen voor webhook security) en een PostgreSQL database opzet.
2. Initialiseer in een submap `crawlee-api` een nieuw Node.js/TypeScript project.
3. Installeer Express (of Fastify), Crawlee, Playwright en Turndown.
4. Zorg dat de API lokaal gestart kan worden en via `docker-compose` kan draaien.

### Phase 2: Core Scraping & Markdown Extractie (Firecrawl + Octoparse functionaliteit)
1. Bouw een POST endpoint in de Crawlee API (`/scrape`) dat een URL en optionele CSS-selectors accepteert.
2. Configureer `PlaywrightCrawler` om headless de pagina te bezoeken, te wachten op netwerk/JS rendering, en anti-bot (stealth) plugins te gebruiken.
3. **CRITICAAL**: Configureer de browser proxy settings hardcoded of via ENV om via `socks5://127.0.0.1:1080` te routeren.
4. Haal de HTML body op, converteer deze via `Turndown` naar schone Markdown, en stuur een JSON response terug met titel, raw HTML, en de Markdown text.

### Phase 3: AI Orkestratie & Integratie (Gumloop functionaliteit)
1. Configureer n8n in je setup zodat de "Advanced AI" nodes (LangChain) geactiveerd zijn.
2. Maak een (JSON geëxporteerde) voorbeeld-workflow voor n8n die:
   - Een lijst van URLs inlaadt.
   - Per URL een HTTP Request doet naar jouw gebouwde `/scrape` endpoint.
   - De resulterende Markdown via een LangChain/OpenAI node samenvat of specifieke datapunten (JSON) extraheert.
   - De resultaten wegschrijft naar de PostgreSQL database.

### Phase 4: Productie Polish
1. Voeg error-handling en retries toe in de Crawlee API (bijv. timeout afhandeling).
2. Voeg rate-limiting toe aan de API.
3. Update de documentatie (README.md) met instructies over hoe het systeem lokaal te starten en de n8n workflow te importeren.
4. Controleer of aan alle eisen uit `AGENTS.md` is voldaan.

Start nu met Phase 1 en laat me weten als de docker-compose en basis TypeScript opzet klaar zijn.
