const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const { collectSource, canonicalUrl } = require('./radar/collector');
const { CATALOG, enrich } = require('./radar/sources');

let db;
let mainWindow;
let syncPromise = null;

function addColumn(table, definition) {
  const name = definition.trim().split(/\s+/)[0];
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function initDatabase() {
  db = new Database(path.join(app.getPath('userData'), 'radar_ambiental.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      url TEXT,
      priority INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      last_checked TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      document_type TEXT,
      document_number TEXT,
      year INTEGER,
      date_issued TEXT,
      entity TEXT,
      jurisdiction TEXT,
      status TEXT,
      topic TEXT,
      importance TEXT DEFAULT 'media',
      summary TEXT,
      source_url TEXT,
      pdf_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migraciones no destructivas desde V0.1/V0.2/V0.3.
  [
    'last_success TEXT','last_error TEXT','documents_found INTEGER DEFAULT 0','authority TEXT','geographic_scope TEXT',
    'department TEXT','municipality TEXT','coverage TEXT','source_category TEXT','sector TEXT'
  ].forEach(c => addColumn('sources', c));
  [
    'identity_key TEXT','content_hash TEXT','first_seen TEXT','last_seen TEXT','updated_at TEXT','is_new INTEGER DEFAULT 1',
    'date_published TEXT','authority TEXT','geographic_scope TEXT','department TEXT','municipality TEXT','document_family TEXT',
    'main_topic TEXT','subtopics TEXT','keywords TEXT','about_text TEXT','legal_force TEXT','source_name TEXT','repository_url TEXT',
    "ai_status TEXT DEFAULT 'pendiente'",'source_category TEXT','sector TEXT','content_kind TEXT','news_category TEXT',
    'business_impact TEXT','relevance_score INTEGER DEFAULT 0','relevance_reason TEXT','alert_level TEXT'
  ].forEach(c => addColumn('documents', c));

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_identity ON documents(identity_key) WHERE identity_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date_issued);
    CREATE INDEX IF NOT EXISTS idx_documents_published ON documents(date_published);
    CREATE INDEX IF NOT EXISTS idx_documents_topic ON documents(topic);
    CREATE INDEX IF NOT EXISTS idx_documents_family ON documents(document_family);
    CREATE INDEX IF NOT EXISTS idx_documents_authority ON documents(authority);
    CREATE INDEX IF NOT EXISTS idx_documents_geo ON documents(geographic_scope, department, municipality);
    CREATE INDEX IF NOT EXISTS idx_documents_sector ON documents(sector);
    CREATE INDEX IF NOT EXISTS idx_documents_relevance ON documents(relevance_score);
    CREATE INDEX IF NOT EXISTS idx_documents_alert_level ON documents(alert_level);

    CREATE TABLE IF NOT EXISTS document_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(document_id, source_id, url),
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      sources_total INTEGER DEFAULT 0,
      sources_ok INTEGER DEFAULT 0,
      found INTEGER DEFAULT 0,
      inserted INTEGER DEFAULT 0,
      updated INTEGER DEFAULT 0,
      unchanged INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS document_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_document_id INTEGER NOT NULL,
      target_document_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      confidence REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_document_id,target_document_id,relation_type),
      FOREIGN KEY(source_document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY(target_document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ai_analysis (
      document_id INTEGER PRIMARY KEY,
      status TEXT DEFAULT 'pendiente',
      ai_summary TEXT,
      topics_json TEXT,
      entities_json TEXT,
      relations_json TEXT,
      model TEXT,
      analyzed_at TEXT,
      FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  const upsert = db.prepare(`INSERT INTO sources (
      name,type,url,priority,active,authority,geographic_scope,department,municipality,coverage,source_category,sector
    ) VALUES (
      @name,@type,@url,@priority,1,@authority,@geographic_scope,@department,@municipality,@coverage,@source_category,@sector
    ) ON CONFLICT(name) DO UPDATE SET
      type=excluded.type,url=excluded.url,priority=excluded.priority,active=1,authority=excluded.authority,
      geographic_scope=excluded.geographic_scope,department=excluded.department,municipality=excluded.municipality,
      coverage=excluded.coverage,source_category=excluded.source_category,sector=excluded.sector`);

  db.transaction(() => CATALOG.forEach(s => upsert.run({
    name:s.name,type:s.type,url:s.url,priority:s.priority||1,authority:s.authority||s.name,
    geographic_scope:s.geographic_scope||'Colombia',department:s.department||null,municipality:s.municipality||null,
    coverage:s.coverage||null,source_category:s.source_category||'Fuente institucional',sector:s.sector||null
  })))();

  // Alias antiguos: se conservan para trazabilidad, pero no se rastrean de nuevo.
  db.prepare(`UPDATE sources SET active=0 WHERE name IN ('Ministerio de Ambiente','ANLA','Corte Constitucional','Consejo de Estado / CENDOJ')`).run();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 930, minWidth: 1080, minHeight: 700,
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false }
  });
  mainWindow.loadFile(path.join(__dirname,'../renderer/index.html'));
  mainWindow.webContents.setWindowOpenHandler(({url}) => { if (/^https?:/i.test(url)) shell.openExternal(url); return {action:'deny'}; });
  mainWindow.webContents.once('did-finish-load', () => startSync('startup'));
}

function emitSync(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync:progress', payload);
}

function saveDocument(doc, source) {
  const now = new Date().toISOString();
  const sourceUrl = canonicalUrl(doc.source_url);
  let existing = doc.identity_key ? db.prepare('SELECT * FROM documents WHERE identity_key=?').get(doc.identity_key) : null;
  if (!existing && sourceUrl) existing = db.prepare('SELECT * FROM documents WHERE source_url=?').get(sourceUrl);
  let id, state;

  const payload = {
    ...doc,
    source_url: sourceUrl,
    authority: doc.authority || source.authority || source.name,
    entity: doc.entity || source.authority || source.name,
    geographic_scope: doc.geographic_scope || source.geographic_scope || 'Colombia',
    jurisdiction: doc.jurisdiction || source.geographic_scope || 'Colombia',
    source_name: doc.source_name || source.name,
    repository_url: doc.repository_url || source.url,
    source_category: doc.source_category || source.source_category || 'Fuente institucional',
    sector: doc.sector || source.sector || null,
    now
  };

  if (!existing) {
    const r = db.prepare(`INSERT INTO documents (
      title,document_type,document_family,document_number,year,date_issued,date_published,entity,authority,jurisdiction,geographic_scope,department,municipality,
      status,legal_force,topic,main_topic,subtopics,keywords,importance,about_text,summary,source_name,source_url,pdf_url,repository_url,
      identity_key,content_hash,first_seen,last_seen,updated_at,is_new,ai_status,source_category,sector,content_kind,news_category,
      business_impact,relevance_score,relevance_reason,alert_level
    ) VALUES (
      @title,@document_type,@document_family,@document_number,@year,@date_issued,@date_published,@entity,@authority,@jurisdiction,@geographic_scope,@department,@municipality,
      @status,@legal_force,@topic,@main_topic,@subtopics,@keywords,@importance,@about_text,@summary,@source_name,@source_url,@pdf_url,@repository_url,
      @identity_key,@content_hash,@now,@now,@now,1,'pendiente',@source_category,@sector,@content_kind,@news_category,
      @business_impact,@relevance_score,@relevance_reason,@alert_level
    )`).run(payload);
    id = r.lastInsertRowid; state = 'inserted';
  } else {
    id = existing.id;
    const sameStoryDifferentSource = existing.document_family === 'Noticias y alertas' && payload.document_family === 'Noticias y alertas' && existing.source_name !== payload.source_name;

    if (sameStoryDifferentSource) {
      // Una misma noticia puede estar replicada por varios gremios. Conservamos una ficha y agregamos la nueva fuente sin hacerla oscilar.
      db.prepare(`UPDATE documents SET
        last_seen=@now,
        date_published=COALESCE(date_published,@date_published),
        relevance_score=MAX(COALESCE(relevance_score,0),COALESCE(@relevance_score,0)),
        business_impact=CASE WHEN COALESCE(business_impact,'')='' THEN @business_impact ELSE business_impact END,
        relevance_reason=CASE WHEN COALESCE(relevance_reason,'')='' THEN @relevance_reason ELSE relevance_reason END
        WHERE id=@id`).run({...payload,id});
      state = 'unchanged';
    } else if (existing.content_hash !== doc.content_hash) {
      db.prepare(`UPDATE documents SET
        title=@title,document_type=@document_type,document_family=@document_family,document_number=@document_number,year=COALESCE(@year,year),
        date_issued=COALESCE(@date_issued,date_issued),date_published=COALESCE(@date_published,date_published),entity=@entity,authority=@authority,
        jurisdiction=@jurisdiction,geographic_scope=@geographic_scope,department=COALESCE(@department,department),municipality=COALESCE(@municipality,municipality),
        status=@status,legal_force=@legal_force,topic=@topic,main_topic=@main_topic,subtopics=@subtopics,keywords=@keywords,importance=@importance,
        about_text=@about_text,summary=@summary,source_name=@source_name,source_url=@source_url,pdf_url=COALESCE(@pdf_url,pdf_url),repository_url=@repository_url,
        content_hash=@content_hash,last_seen=@now,updated_at=@now,is_new=1,ai_status='pendiente',source_category=@source_category,sector=@sector,
        content_kind=@content_kind,news_category=@news_category,business_impact=@business_impact,relevance_score=@relevance_score,
        relevance_reason=@relevance_reason,alert_level=@alert_level
        WHERE id=@id`).run({...payload,id});
      state = 'updated';
    } else {
      db.prepare('UPDATE documents SET last_seen=? WHERE id=?').run(now,id);
      state = 'unchanged';
    }
  }

  db.prepare(`INSERT INTO document_sources(document_id,source_id,url,first_seen,last_seen) VALUES (?,?,?,?,?)
    ON CONFLICT(document_id,source_id,url) DO UPDATE SET last_seen=excluded.last_seen`)
    .run(id,source.id,sourceUrl,now,now);
  return state;
}

async function startSync(reason='manual') {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const sources = db.prepare('SELECT * FROM sources WHERE active=1 ORDER BY priority,name').all().map(enrich);
    const started = new Date().toISOString();
    const run = db.prepare(`INSERT INTO sync_runs(started_at,status,sources_total) VALUES (?,'running',?)`).run(started,sources.length);
    const stats = {runId:run.lastInsertRowid,reason,sourcesTotal:sources.length,current:0,sourcesOk:0,found:0,inserted:0,updated:0,unchanged:0,errors:0};
    emitSync({status:'started',...stats});
    for (const source of sources) {
      stats.current++;
      emitSync({status:'source',source:source.name,...stats});
      try {
        const result = await collectSource(source);
        stats.found += result.documents.length;
        db.transaction(() => result.documents.forEach(doc => { const s=saveDocument(doc,source); stats[s]++; }))();
        const err = result.errors.length ? result.errors.join(' | ').slice(0,4000) : null;
        if (result.documents.length || !result.errors.length) stats.sourcesOk++; else stats.errors++;
        db.prepare('UPDATE sources SET last_checked=?,last_success=?,last_error=?,documents_found=? WHERE id=?')
          .run(new Date().toISOString(), result.documents.length || !result.errors.length ? new Date().toISOString() : source.last_success, err, result.documents.length, source.id);
      } catch(e) {
        stats.errors++;
        db.prepare('UPDATE sources SET last_checked=?,last_error=? WHERE id=?').run(new Date().toISOString(),String(e.message||e).slice(0,4000),source.id);
      }
    }
    db.prepare(`UPDATE sync_runs SET finished_at=?,status='finished',sources_ok=?,found=?,inserted=?,updated=?,unchanged=?,errors=? WHERE id=?`)
      .run(new Date().toISOString(),stats.sourcesOk,stats.found,stats.inserted,stats.updated,stats.unchanged,stats.errors,stats.runId);
    emitSync({status:'finished',...stats});
    return stats;
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

function documentQuery(filters={}) {
  let sql = `SELECT d.* FROM documents d WHERE 1=1`;
  const p = {};
  if (filters.search) {
    sql += ` AND (d.title LIKE @search OR d.authority LIKE @search OR d.topic LIKE @search OR d.main_topic LIKE @search OR d.subtopics LIKE @search OR d.keywords LIKE @search OR d.summary LIKE @search OR d.about_text LIKE @search OR d.document_number LIKE @search OR d.sector LIKE @search OR d.business_impact LIKE @search OR d.relevance_reason LIKE @search)`;
    p.search = `%${filters.search}%`;
  }
  if (filters.topic) { sql += ' AND COALESCE(d.main_topic,d.topic)=@topic'; p.topic=filters.topic; }
  if (filters.authority) { sql += ' AND d.authority=@authority'; p.authority=filters.authority; }
  if (filters.geography) { sql += ` AND (d.geographic_scope=@geography OR d.department=@geography OR d.municipality=@geography)`; p.geography=filters.geography; }
  if (filters.family) { sql += ' AND d.document_family=@family'; p.family=filters.family; }
  if (filters.sector) { sql += ' AND d.sector=@sector'; p.sector=filters.sector; }
  if (filters.alertLevel) { sql += ' AND d.alert_level=@alertLevel'; p.alertLevel=filters.alertLevel; }
  if (filters.newOnly) sql += ' AND d.is_new=1';
  if (filters.excludeIntelligence) sql += ` AND COALESCE(d.document_family,'')<>'Noticias y alertas'`;
  if (filters.jurisprudence) sql += ` AND d.document_family='Jurisprudencia'`;
  if (filters.intelligence) sql += ` AND d.document_family='Noticias y alertas'`;
  if (filters.regulatoryAlerts) sql += ` AND d.document_type='Alerta regulatoria'`;
  if (filters.intelligence) sql += ' ORDER BY COALESCE(d.relevance_score,0) DESC, COALESCE(d.date_published,d.first_seen,d.created_at) DESC LIMIT 800';
  else sql += ' ORDER BY COALESCE(d.date_published,d.date_issued,d.first_seen,d.created_at) DESC LIMIT 800';
  return {sql,p};
}

ipcMain.handle('sources:list', () => db.prepare('SELECT * FROM sources WHERE active=1 ORDER BY priority,name').all());
ipcMain.handle('documents:list', (_,filters={}) => { const {sql,p}=documentQuery(filters); return db.prepare(sql).all(p); });
ipcMain.handle('filters:get', () => ({
  topics: db.prepare(`SELECT DISTINCT COALESCE(main_topic,topic) value FROM documents WHERE COALESCE(main_topic,topic) IS NOT NULL AND COALESCE(main_topic,topic)<>'' ORDER BY value`).all().map(x=>x.value),
  authorities: db.prepare(`SELECT DISTINCT authority value FROM documents WHERE authority IS NOT NULL AND authority<>'' ORDER BY value`).all().map(x=>x.value),
  geographies: db.prepare(`SELECT DISTINCT geographic_scope value FROM documents WHERE geographic_scope IS NOT NULL AND geographic_scope<>'' UNION SELECT DISTINCT department FROM documents WHERE department IS NOT NULL AND department<>'' UNION SELECT DISTINCT municipality FROM documents WHERE municipality IS NOT NULL AND municipality<>'' ORDER BY value`).all().map(x=>x.value),
  families: db.prepare(`SELECT DISTINCT document_family value FROM documents WHERE document_family IS NOT NULL AND document_family<>'' ORDER BY value`).all().map(x=>x.value),
  sectors: db.prepare(`SELECT DISTINCT sector value FROM documents WHERE sector IS NOT NULL AND sector<>'' ORDER BY value`).all().map(x=>x.value),
  alertLevels: ['Alta','Media','Informativa']
}));
ipcMain.handle('dashboard:get', () => ({
  total: db.prepare('SELECT COUNT(*) n FROM documents').get().n,
  newDocuments: db.prepare('SELECT COUNT(*) n FROM documents WHERE is_new=1').get().n,
  jurisprudence: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family='Jurisprudencia'`).get().n,
  planning: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family IN ('Plan / instrumento','Política pública')`).get().n,
  technical: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family='Técnico'`).get().n,
  normative: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family='Normativa'`).get().n,
  intelligence: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family='Noticias y alertas'`).get().n,
  regulatoryAlerts: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_type='Alerta regulatoria'`).get().n,
  highAlerts: db.prepare(`SELECT COUNT(*) n FROM documents WHERE document_family='Noticias y alertas' AND alert_level='Alta'`).get().n,
  byTopic: db.prepare(`SELECT COALESCE(main_topic,topic,'Sin clasificar') label, COUNT(*) value FROM documents GROUP BY COALESCE(main_topic,topic,'Sin clasificar') ORDER BY value DESC LIMIT 9`).all(),
  byFamily: db.prepare(`SELECT COALESCE(document_family,'Sin clasificar') label, COUNT(*) value FROM documents GROUP BY COALESCE(document_family,'Sin clasificar') ORDER BY value DESC`).all(),
  latest: db.prepare(`SELECT * FROM documents WHERE COALESCE(document_family,'')<>'Noticias y alertas' ORDER BY COALESCE(date_published,date_issued,first_seen,created_at) DESC LIMIT 7`).all(),
  latestIntelligence: db.prepare(`SELECT * FROM documents WHERE document_family='Noticias y alertas' ORDER BY COALESCE(relevance_score,0) DESC, COALESCE(date_published,first_seen,created_at) DESC LIMIT 7`).all()
}));
ipcMain.handle('sync:start', () => startSync('manual'));
ipcMain.handle('sync:last', () => db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1').get() || null);
ipcMain.handle('documents:mark-seen', (_,scope='all') => {
  if(scope==='documents') db.prepare(`UPDATE documents SET is_new=0 WHERE COALESCE(document_family,'')<>'Noticias y alertas'`).run();
  else if(scope==='intelligence') db.prepare(`UPDATE documents SET is_new=0 WHERE document_family='Noticias y alertas'`).run();
  else db.prepare('UPDATE documents SET is_new=0').run();
  return true;
});

app.whenReady().then(() => { initDatabase(); createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();}); });
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
