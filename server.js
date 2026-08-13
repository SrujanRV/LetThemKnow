require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const path  = require('path');
const cors  = require('cors');
const fs    = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ── Supabase (optional – falls back to local fs) ───────────────────────────
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
let supabase = null;
if (USE_SUPABASE) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('Using Supabase for storage');
} else {
  console.log('Using local file storage');
}

const uploadsDir = path.join(__dirname, 'uploads');
const dataDir    = path.join(__dirname, 'data');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir))    fs.mkdirSync(dataDir,    { recursive: true });

// ── Constants ──────────────────────────────────────────────────────────────
const EXPIRY_MS = 48 * 60 * 60 * 1000;   // 48 hours

// ── helpers ────────────────────────────────────────────────────────────────

function isExpired(cfg) {
  if (!cfg || !cfg.createdAt) return false;
  return Date.now() - cfg.createdAt > EXPIRY_MS;
}

async function uploadFile(buffer, filename, mimetype, id) {
  if (USE_SUPABASE) {
    const filePath = id + '/' + filename;
    const { error } = await supabase.storage
      .from('radio-media')
      .upload(filePath, buffer, { contentType: mimetype, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('radio-media').getPublicUrl(filePath);
    return data.publicUrl;
  } else {
    const dir = path.join(uploadsDir, id);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
    return '/uploads/' + id + '/' + filename;
  }
}

async function saveConfig(id, config) {
  if (USE_SUPABASE) {
    const { error } = await supabase.from('radios').insert({ id, config });
    if (error) throw error;
  } else {
    fs.writeFileSync(path.join(dataDir, id + '.json'), JSON.stringify(config, null, 2));
  }
}

async function getConfig(id) {
  if (USE_SUPABASE) {
    const { data, error } = await supabase
      .from('radios').select('config').eq('id', id).single();
    if (error) throw error;
    return data.config;
  } else {
    const filePath = path.join(dataDir, id + '.json');
    if (!fs.existsSync(filePath)) throw new Error('Not found');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

// ── Auto-expiry cleanup ────────────────────────────────────────────────────

function cleanupExpired() {
  if (USE_SUPABASE) return;   // local-only
  try {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    let removed = 0;
    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        const cfg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (isExpired(cfg)) {
          const id = file.replace('.json', '');
          fs.unlinkSync(filePath);
          const uploadPath = path.join(uploadsDir, id);
          if (fs.existsSync(uploadPath)) fs.rmSync(uploadPath, { recursive: true, force: true });
          removed++;
        }
      } catch (_) {}
    }
    if (removed > 0) console.log('[cleanup] removed ' + removed + ' expired radio(s)');
  } catch (err) {
    console.error('[cleanup] error:', err.message);
  }
}

// Run on startup, then every 30 minutes
cleanupExpired();
setInterval(cleanupExpired, 30 * 60 * 1000);

// ── Routes ─────────────────────────────────────────────────────────────────

// Health check — used by Railway / uptime pingers
app.get('/health', (req, res) => res.send('ok'));

// Serve uploaded files
app.get('/uploads/:id/:file', (req, res) => {
  const p = path.join(uploadsDir, req.params.id, req.params.file);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(p);
});

// ── POST /api/create ───────────────────────────────────────────────────────
app.post('/api/create',
  upload.fields([{ name: 'photos', maxCount: 50 }, { name: 'audio', maxCount: 1 }]),
  async (req, res) => {
    try {
      const config = JSON.parse(req.body.config);
      const id = config.id ? String(config.id).trim() : uuidv4();
      
      console.log('[create] incoming config:', JSON.stringify(config, null, 2));
      console.log('[create] incoming photos:', config.photos ? config.photos.length : 0);
      console.log('[create] received files:', req.files ? Object.keys(req.files) : 'none');
      if (req.files && req.files['photos']) {
        console.log('[create] photos files count:', req.files['photos'].length);
      }

      const photoUrls = [];
      const incomingPhotos = config.photos || [];
      
      // Merge new uploads and existing photo URLs
      for (let i = 0; i < incomingPhotos.length; i++) {
        const p = incomingPhotos[i];
        if (p.isNew) {
          const file = req.files['photos'][p.fileIdx];
          const ext  = path.extname(file.originalname) || '.jpg';
          const name = 'photo_' + i + ext;
          const url  = await uploadFile(file.buffer, name, file.mimetype, id);
          photoUrls.push({ url, caption: p.caption });
        } else {
          photoUrls.push({ url: p.url, caption: p.caption });
        }
      }
      console.log('[create] built photoUrls:', JSON.stringify(photoUrls, null, 2));

      // Preserves existing audioUrl if no new audio is uploaded on edit
      let audioUrl = config.audioUrl || null;
      if (req.files['audio']) {
        const file = req.files['audio'][0];
        const ext  = path.extname(file.originalname) || '.mp3';
        audioUrl   = await uploadFile(file.buffer, 'audio' + ext, file.mimetype, id);
      }

      const finalConfig = {
        id,
        createdAt:      Date.now(), // refresh createdAt timestamp
        photos:         photoUrls,
        audioUrl,
        audioStart:     config.audioStart   || 0,
        audioEnd:       config.audioEnd     || 0,
        radioStyle:     config.radioStyle   || 'kawaii',
        filmPattern:    config.filmPattern  || 'classic',
        fontId:         config.fontId       || 'playful',
        title:          config.title        || 'for you, always',
        tagline:        config.tagline      || 'turn the knob \u2014 every notch is a memory',
        captionDefault: config.captionDefault || 'press play and turn the dial\u2026',
        knobLabel:      config.knobLabel    || 'tune',
        hint:           config.hint         || 'drag the knob to scrub \u2014 press \u266b to play',
        lockQuestion:   config.lockQuestion || '',
        lockCode:       config.lockCode     || ''
      };

      await saveConfig(id, finalConfig);
      res.json({ id });
    } catch (err) {
      console.error('Create error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── GET /api/gate/:id ──────────────────────────────────────────────────────
// Returns only { question } — never the code, never file paths.
app.get('/api/gate/:id', async (req, res) => {
  try {
    const cfg = await getConfig(req.params.id);
    if (isExpired(cfg)) return res.status(410).json({ expired: true });
    res.json({ question: cfg.lockQuestion || '' });
  } catch (_) {
    res.status(410).json({ expired: true });
  }
});

// ── POST /api/verify/:id ───────────────────────────────────────────────────
// Accepts { code }, compares server-side. On match returns safe config.
app.post('/api/verify/:id', async (req, res) => {
  try {
    const cfg  = await getConfig(req.params.id);
    if (isExpired(cfg)) return res.status(410).json({ expired: true });

    const submitted = String(req.body.code || '').trim();
    const stored    = String(cfg.lockCode  || '').trim();

    if (submitted !== stored) return res.json({ ok: false });

    // Return only what the radio player needs — never the lockCode
    const safeConfig = {
      id:             cfg.id,
      photos:         cfg.photos,
      audioUrl:       cfg.audioUrl,
      audioStart:     cfg.audioStart,
      audioEnd:       cfg.audioEnd,
      radioStyle:     cfg.radioStyle,
      filmPattern:    cfg.filmPattern,
      fontId:         cfg.fontId,
      title:          cfg.title,
      tagline:        cfg.tagline,
      captionDefault: cfg.captionDefault,
      knobLabel:      cfg.knobLabel,
      hint:           cfg.hint,
      lockQuestion:   cfg.lockQuestion
    };
    res.json({ ok: true, config: safeConfig });
  } catch (_) {
    res.status(410).json({ expired: true });
  }
});

// ── GET /api/edit-config/:id ───────────────────────────────────────────────
// Authenticated GET route. Returns the FULL config for editing.
app.get('/api/edit-config/:id', async (req, res) => {
  try {
    const cfg = await getConfig(req.params.id);
    if (isExpired(cfg)) return res.status(410).json({ expired: true });

    const submitted = String(req.query.code || '').trim();
    const stored    = String(cfg.lockCode  || '').trim();

    if (submitted !== stored) {
      return res.status(403).json({ error: 'Invalid lock code' });
    }

    res.json(cfg);
  } catch (_) {
    res.status(404).json({ error: 'Radio not found' });
  }
});

// ── GET /api/config/:id  (internal / legacy — still gated by expiry) ───────
app.get('/api/config/:id', async (req, res) => {
  try {
    const cfg = await getConfig(req.params.id);
    if (isExpired(cfg)) return res.status(410).json({ expired: true });
    // Strip the lock code before returning
    const { lockCode: _omit, ...safe } = cfg;   // eslint-disable-line no-unused-vars
    res.json(safe);
  } catch (_) {
    res.status(404).json({ error: 'Radio not found' });
  }
});

// ── Page routes ────────────────────────────────────────────────────────────
app.get('/radio/:id', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'radio.html'))
);
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n✦ Radio Surprise running at http://localhost:' + PORT);
  if (!USE_SUPABASE) console.log('  (local mode \u2014 files stored in /uploads and /data)');
});