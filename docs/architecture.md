# RepoMind Technical Architecture

## High-Level System Overview

```mermaid
graph TB
    subgraph "Frontend (Next.js 16)"
        UI[Dashboard UI]
        CHAT[Chat UI]
        API[API Route Handlers]
    end

    subgraph "RAG Query Engine"
        QA[Query Analyzer]
        RET[Retriever]
        PB[Prompt Builder]
        PR[Provider Registry]
        EV[Evaluation Harness]
    end

    subgraph "Indexing Pipeline"
        PO[Pipeline Orchestrator]
        GH[GitHub Client]
        FC[File Cache]
        FF[File Filter]
        TP[Tree-sitter Parser]
        AA[AST Analyzer]
        SC[Semantic Chunker]
        GB[Graph Builder]
        EP[Embedding Provider]
    end

    subgraph "External Services"
        GHA[GitHub API]
        OLL[Ollama]
        OAI[OpenAI]
        ANT[Anthropic Claude]
        COH[Cohere]
    end

    subgraph "Storage (Supabase)"
        PG[(PostgreSQL)]
        PGV[(pgvector + FTS)]
        AUTH[Supabase Auth]
    end

    UI --> API
    CHAT --> API
    API --> PO
    API --> RET
    RET --> QA
    RET --> PGV
    RET --> PB
    PB --> PR
    PR --> OLL
    PR --> OAI
    PR --> ANT
    RET --> COH
    PO --> GH
    GH --> GHA
    GH --> FC
    FC --> PG
    PO --> FF
    PO --> TP
    TP --> AA
    AA --> SC
    AA --> GB
    SC --> EP
    EP --> OLL
    EP --> OAI
    SC --> PGV
    GB --> PG
    UI --> AUTH
```

## Data Flow: Full Indexing

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Routes
    participant P as Pipeline
    participant GH as GitHub API
    participant FC as File Cache
    participant TS as Tree-sitter
    participant CH as Chunker
    participant EM as Embeddings
    participant DB as Supabase

    U->>API: POST /api/repos/:id/index
    API->>P: startIndexingJob()
    P->>P: Check concurrency guard
    P->>DB: Create indexing_job (pending)
    P->>GH: getFileTree()
    GH-->>P: File list + SHAs
    P->>P: Apply file filters
    P->>EM: validateDimensions()

    loop Per batch (1-5 files)
        P->>FC: fetchOrCacheFile()
        FC->>GH: getFileContent() (if cache miss)
        GH-->>FC: File content
        FC->>DB: Cache file (SHA-based)
        FC-->>P: Content

        P->>TS: parseCode()
        TS-->>P: AST Tree

        P->>CH: chunkFile(code, symbols)
        CH-->>P: ChunkResult[]

        P->>EM: embed(contextualizedTexts)
        EM-->>P: number[][] (1536d vectors)

        P->>DB: upsertChunks()
        P->>DB: upsertEdges()
        P->>DB: updateJobProgress()
    end

    P->>DB: Update job status (completed/partial)
    P->>DB: Set lastIndexedCommit
    P-->>API: IndexingJob
    API-->>U: { jobId, status, progress }
```

## Data Flow: Incremental Indexing

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant GH as GitHub API
    participant DB as Supabase

    P->>GH: compareCommits(lastCommit, HEAD)
    GH-->>P: DiffEntry[] (added/modified/deleted/renamed)

    loop Per changed file
        alt Added
            P->>P: Fetch, parse, chunk, embed, store
        else Modified
            P->>DB: deleteChunksByFile()
            P->>DB: deleteEdgesByFile()
            P->>P: Fetch, parse, chunk, embed, store
        else Deleted
            P->>DB: deleteChunksByFile()
            P->>DB: deleteEdgesByFile()
        else Renamed
            P->>DB: deleteChunksByFile(oldPath)
            P->>DB: deleteEdgesByFile(oldPath)
            P->>P: Fetch, parse, chunk, embed, store (newPath)
        end
    end
```

## Entity Relationship Diagram

```mermaid
erDiagram
    repositories ||--o{ repository_settings : "has one"
    repositories ||--o{ cached_files : "caches"
    repositories ||--o{ code_chunks : "contains"
    repositories ||--o{ graph_edges : "has"
    repositories ||--o{ indexing_jobs : "tracks"

    repositories {
        uuid id PK
        uuid org_id
        text name
        text full_name UK
        text url
        text default_branch
        text last_indexed_commit
        github_auth_type github_auth_type
        timestamptz created_at
        timestamptz updated_at
    }

    repository_settings {
        uuid id PK
        uuid repo_id FK
        text[] branch_filter
        text[] include_patterns
        text[] exclude_patterns
        text embedding_provider
        text embedding_model
        boolean auto_index_on_add
    }

    cached_files {
        bigint id PK
        uuid repo_id FK
        text file_path
        text content
        text sha
        text language
        integer size_bytes
        boolean is_generated
    }

    code_chunks {
        bigint id PK
        uuid repo_id FK
        text file_path
        integer chunk_index
        text content
        text contextualized_content
        text language
        text symbol_name
        text symbol_type
        integer start_line
        integer end_line
        text parent_scope
        vector_1536 embedding
        text embedding_model
    }

    graph_edges {
        bigint id PK
        uuid repo_id FK
        text source_file
        text source_symbol
        text source_type
        text target_file
        text target_symbol
        text target_type
        relationship_type relationship_type
        jsonb metadata
    }

    indexing_jobs {
        uuid id PK
        uuid repo_id FK
        indexing_job_status status
        indexing_job_trigger trigger_type
        text from_commit
        text to_commit
        integer total_files
        integer processed_files
        integer failed_files
        text current_file
        jsonb error_log
        timestamptz last_heartbeat_at
        timestamptz completed_at
    }
```

## Module Dependency Graph

```mermaid
graph LR
    subgraph "Types Layer"
        T1[types/repository]
        T2[types/indexing]
        T3[types/graph]
        T4[types/embedding]
    end

    subgraph "Storage Layer"
        ST[storage/types]
        SS[storage/supabase]
    end

    subgraph "GitHub Layer"
        GT[github/types]
        GP[github/pat-auth]
        GC[github/client]
        GF[github/cache]
    end

    subgraph "Indexer Layer"
        PA[indexer/parser]
        LA[indexer/languages]
        FF[indexer/file-filter]
        AA[indexer/ast-analyzer]
        QR[indexer/queries/ruby]
        QT[indexer/queries/typescript]
        QI[indexer/queries/index]
        CH[indexer/chunker]
        IR[indexer/import-resolver]
        GB[indexer/graph-builder]
        ET[indexer/embedding/types]
        EO[indexer/embedding/ollama]
        EP[indexer/embedding/openai]
        EI[indexer/embedding/index]
        PL[indexer/pipeline]
    end

    subgraph "API Layer"
        AH[api/repos/_helpers]
        AR[api/repos/route]
        AD[api/repos/id/route]
        AI[api/repos/id/index/route]
        AP[api/repos/id/index/process]
        AS[api/repos/id/status]
        AE[api/repos/id/settings]
    end

    ST --> T1 & T2 & T3
    SS --> ST
    GF --> GC & ST
    AA --> LA & QI
    QI --> QR & QT
    CH --> AA & T2
    GB --> AA & IR & T3
    PL --> SS & GC & GF & FF & AA & CH & GB & EI & PA
    AH --> SS
    AR --> AH & GC
    AI --> AH & PL & GC & GF & EI
    AP --> AH & PL & GC & GF & EI
    AS --> AH & PL
    AE --> AH
```

## AST Processing Pipeline

```mermaid
graph TD
    CODE[Source Code] --> PARSE[Tree-sitter Parse]
    PARSE --> AST[AST Tree]

    AST --> SYM[Extract Symbols]
    AST --> IMP[Extract Imports]
    AST --> CALL[Extract Call Sites]
    AST --> INH[Extract Inheritance]

    SYM --> SCOPE[Build Scope Tree]
    SCOPE --> PACK[Greedy Bin-Packing]
    PACK --> MERGE[Merge Small Chunks]
    MERGE --> OVERLAP[Add Overlap]
    OVERLAP --> CTX[Prepend Context Header]
    CTX --> CHUNKS["ChunkResult[]"]

    IMP --> RESOLVE[Import Resolution]
    CALL --> |callee lookup| RESOLVE
    INH --> |parent lookup| RESOLVE
    RESOLVE --> EDGES["GraphEdgeInsert[]"]

    CHUNKS --> EMBED[Embedding Provider]
    EMBED --> STORE[Supabase pgvector]
    EDGES --> STORE
```

## Self-Chaining Batch Processing

```mermaid
stateDiagram-v2
    [*] --> Pending
    note right of Pending
        POST /api/repos/id/index
    end note
    Pending --> FetchingFiles : Fetch file tree
    FetchingFiles --> Processing : Files filtered

    Processing --> Processing : POST next batch
    note right of Processing
        Each call processes 1-5 files
        Updates heartbeat
        Client polls with Retry-After: 2
    end note

    Processing --> Completed : All files done, 0 failures
    Processing --> Partial : All files done, some failures
    Processing --> Failed : Stale (no heartbeat > 5min)
    Processing --> Failed : Embedding validation error

    Completed --> [*]
    Partial --> [*]
    Failed --> [*]
```

## Knowledge Graph Edge Types

```mermaid
graph LR
    subgraph "Relationship Types"
        A[file_a.ts] -->|imports| B[file_b.ts]
        C[functionA] -->|calls| D[functionB]
        E[ChildClass] -->|inherits| F[ParentClass]
        G[MyClass] -->|composes| H[MixinModule]
        I[file.ts] -->|depends_on| J[module]
        K[file.rb] -->|external_dep| L[gem_name]
    end
```

## Security Model

```mermaid
graph TB
    subgraph "Client (Browser)"
        USER[Authenticated User]
    end

    subgraph "Auth Layer"
        PROXY[proxy.ts - getUser]
        JWT[Supabase JWT]
    end

    subgraph "API Routes"
        HELPER[_helpers.ts - getAuthContext]
        ROUTES[Route Handlers]
    end

    subgraph "Storage"
        UC[User Client - RLS enforced]
        SC[Service Client - bypasses RLS]
    end

    subgraph "Database"
        RLS[RLS Policies - org_id check]
        SECDEF[SECURITY DEFINER functions]
    end

    USER --> PROXY
    PROXY --> JWT
    JWT --> HELPER
    HELPER --> ROUTES
    ROUTES -->|reads| UC
    ROUTES -->|writes via pipeline| SC
    UC --> RLS
    SC --> SECDEF
    SECDEF -->|hybrid_search_chunks| RLS
    SECDEF -->|upsert_file_chunks with org_id check| RLS
```

## RAG Query Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Chat UI (useChat)
    participant API as POST /api/chat
    participant QA as Query Analyzer
    participant RET as Retriever
    participant EP as Embedding Provider
    participant DB as Supabase (hybrid_search_chunks)
    participant GE as Graph Edges
    participant PB as Prompt Builder
    participant LLM as LLM Provider (Ollama/Claude/OpenAI)

    U->>UI: Type question, select repos
    UI->>API: sendMessage({ text, repoIds })
    API->>QA: analyzeQuery(question)
    QA-->>API: { queryType, suggestedGraphDepth }
    API->>EP: embedSingle(question)
    EP-->>API: vector[1536]
    API->>DB: hybrid_search_chunks(vector, text, repoIds)
    Note over DB: pgvector cosine + FTS tsvector<br/>Reciprocal Rank Fusion (k=60)
    DB-->>RET: ranked chunks with RRF scores
    RET->>GE: getRelatedEdgesBatch(symbols, depth)
    GE-->>RET: graph context (1-2 hops)
    RET-->>API: RetrievalResult + confidence
    API->>PB: buildContextWindow(query, result)
    PB-->>API: { systemPrompt, contextChunks }
    API->>LLM: streamText(model, system, messages)
    LLM-->>UI: SSE stream (text chunks)
    API->>DB: after() -> saveMessage(answer, sources)
```

## RAG Module Dependency Graph

```mermaid
graph LR
    subgraph "RAG Layer"
        RT[rag/types]
        QA[rag/query-analyzer]
        RET[rag/retriever]
        PB[rag/prompt-builder]
        PR[rag/providers]
        EV[rag/__eval__/metrics]
        ER[rag/__eval__/runner]
    end

    subgraph "Chat API"
        CR[api/chat/route]
        CH[api/chat/history]
        CF[api/chat/feedback]
        CS[api/settings/team]
    end

    subgraph "Chat UI"
        CI[components/chat/chat-interface]
        CM[components/chat/chat-messages]
        CIN[components/chat/chat-input]
        SP[components/chat/source-panel]
    end

    RET --> RT & QA & PR
    PB --> RT
    CR --> RET & PB & PR & QA
    CH --> ST
    CF --> ST
    CS --> ST
    CI --> CM & CIN & SP
    ER --> RET & PB & EV

    ST[storage/supabase]
    RET --> ST
```

## New Database Tables (Split 02)

```mermaid
erDiagram
    repositories ||--o{ chat_messages : "queried via"
    chat_messages ||--o{ query_feedback : "rated by"
    team_settings {
        uuid id PK
        uuid org_id UK
        text embedding_provider
        text ollama_base_url
        text[] provider_order
        text claude_api_key
        text openai_api_key
        text cohere_api_key
        integer max_graph_hops
        integer search_top_k
        integer search_rrf_k
    }

    chat_messages {
        uuid id PK
        uuid org_id
        uuid user_id
        uuid session_id
        uuid[] repo_ids
        text question
        text answer
        jsonb sources
        text confidence
        text model_used
        integer retrieval_latency_ms
    }

    query_feedback {
        uuid id PK
        uuid message_id FK
        uuid user_id
        text rating
        text comment
    }
```
