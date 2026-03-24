# Graph-Based Data Modeling and Query System

A context graph system over an Order-to-Cash dataset with an LLM-powered natural language query interface. 
Built as a technical assignment for the Forward Deployed Engineer role.

## Architecture Decisions

### 1. Database Choice: SQLite (In-Memory / Self-Contained)
**Decision**: I chose `SQLite` over `PostgreSQL` or `Neo4j` for this specific assignment.
**Tradeoffs and Reasoning**: 
While PostgreSQL is excellent for production relational data, requiring an interviewer/reviewer to set up a Postgres server and run table creation scripts creates friction for a rapid demo review. 
SQLite provides **100% of the relational processing power** required by the LLM (text-to-SQL logic works identically to Postgres), but allows the entire backend to run entirely standalone via `better-sqlite3`. The database is built on-the-fly from the raw JSON dataset, ensuring zero-configuration for anyone cloning the repository.
It is lightweight, highly performant for this dataset scale, and perfectly satisfies the requirement of extracting entities dynamically into a graph format.

### 2. Graph Construction & Visualization (React Flow)
**Decision**: The graph schema is abstracted from the relational database.
**How**: Rather than forcing the backend into a specialized graph database like `Neo4j`, the relational schema inherently defines edges (Foreign Keys) and nodes (Tables/Rows).
The backend dynamically queries SQLite to project entities (`Customers`, `Orders`, `Deliveries`, `Invoices`, `Journal Entries`) and their relationships (`PLACED`, `SHIPPED_AS`, `BILLED_AS`, `ACCOUNTED_IN`), then serves this to `React Flow`. The UI leverages a sleek dark-mode, custom node configuration with glassmorphic styles.

### 3. LLM Strategy: Groq + Llama 3 (70B)
**Decision**: Used the `Groq` API with `Llama-3.3-70b-versatile` due to its incredibly fast inference speeds which are necessary for multi-step AI pipelines.
**Pipeline**:
1. **NL to SQL Generation**: The user's query is passed to the LLM alongside the SQLite database schema and foreign-key mappings. The LLM is forced via system prompt to output exactly a JSON object containing the SQL query.
2. **Execution**: The Node.js backend executes the SQL on the SQLite database in read-only mode. 
3. **Data Synthesis**: The raw resulting data rows + the original query are passed back to the LLM to synthesize a natural language response grounded *exclusively* in the queried data.

### 4. Guardrails
The system strictly prohibits queries outside of the provided dataset context.
This is enforced at the LLM level in step 1 of the pipeline. The System Prompt instructs the AI: 
*"If the question is unrelated to the dataset or domain (e.g. general knowledge, poem, coding besides this), reply exactly with: `{"sql": null, "rejection": "This system..."}`."* 
If the LLM returns this JSON structure, the backend short-circuits execution, rejects the prompt gracefully to the user, and highlights a specialized UI boundary for the guardrail.

## Setup & Run Instructions

You will need two terminals to run the backend and frontend simultaneously.

### Setup Backend
1. `cd backend`
2. `npm install`
3. Create a `.env` file inside `/backend` and add your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
4. Run the data ingestion to build the SQLite DB:
   ```bash
   node db.js
   ```
5. Start the API server:
   ```bash
   node server.js
   ```

### Setup Frontend
1. Open a new terminal and `cd frontend`
2. `npm install`
3. `npm run dev`
4. Open your browser to `http://localhost:5173/`

### Features Implemented
- **Graph construction** over Orders, Deliveries, Invoices, Customers, etc.
- **Graph Visualization** via React Flow (custom beautiful UI).
- **Conversational Chat Interface** with Natural language to SQL synthesis.
- *(Bonus)* **Highlighting referenced nodes** dynamically directly from the LLM responses (It reads IDs returned and tells the frontend which nodes to highlight!).
- *(Bonus)* **SQL snippet display** within the chat window so users can see exactly how their prompt was translated.
- **Strict Guardrails** discarding irrelevant queries.
