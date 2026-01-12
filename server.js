require('dotenv').config(); 

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');

const app = express()
const db = new sqlite3.Database('./share-your-sound.db')
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// // Active les protections basiques
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
//             scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://open.spotify.com"],
//             frameSrc: ["'self'", "https://www.youtube.com", "https://open.spotify.com", "https://w.soundcloud.com"],
//             imgSrc: ["'self'", "data:", "https:"]
//         }
//     },
//     crossOriginEmbedderPolicy: false // Important pour les iframes
// }));

// Limite pour les posts
const postLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requêtes max
    message: { error: 'Trop de tentatives. Réessayez plus tard.' }
});

// Limite pour les signalements
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 20, // 20 signalements max par IP
    message: { error: 'Trop de signalements.' }
});


app.use(express.json());
app.use(express.static('public'))
app.use(express.static(__dirname + '/views'));
app.use(express.urlencoded({ extended: true }));


db.serialize(() => {

  db.run("CREATE TABLE IF NOT EXISTS posts " + 
         "  (songTitle varchar(255), " + 
         "   songUrl varchar(255), " + 
         "   createdAt DateTime, " + 
         "   expiresAt DateTime, " + 
         "   reports int DEFAULT 0 )")

})

// Toutes les heures à la minute 0
cron.schedule('0 * * * *', () => {
    db.run("DELETE FROM posts WHERE expiresAt < datetime('now')", 
        (err) => {
        }
    );
});

app.get('/', (req, res) => {
  res.render('index')
})

//ROUTES
app.get('/api/posts', (req, res) => {
  
  db.all(
    'SELECT rowid AS id, * FROM posts WHERE expiresAt > ? ORDER BY createdAt DESC',
    [new Date().toISOString()],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
    const postsWithEmbed = rows.map(row => ({
      ...row,
      embedCode: generateEmbedCode(row.songUrl),
    }));
    
    res.json(postsWithEmbed);
    })

  
  
})

app.post('/post', postLimiter, (req, res) => { 
  const title = req.body.songTitle;
  const url = req.body.songUrl;

  
  // 1. Nettoie les données
  const safeTitle = sanitizeTitle(title);
  const safeUrl = sanitizeUrl(url);
  
  // 2. Validation
  if (!safeTitle || safeTitle.length < 2) {
      return res.status(400).json({success : false, error: 'Invalid title' });
  }
  
  if (!safeUrl) {
      return res.status(400).json({success : false, error: 'Invalid URL' });
  }

  db.serialize(() => {
  
    const stmt = db.prepare("INSERT INTO posts (songTitle, songUrl, createdAt, expiresAt) " + 
                            "VALUES (?, ?, datetime('now'), datetime('now', '+1 day'))")
  
    stmt.run(safeTitle,safeUrl)

    stmt.finalize()

    })


    res.json({success : true});
});


app.post('/report/:id', reportLimiter, (req, res) => {
    const id = req.params.id;
    
    try {
        // 1. Incrémenter reports pour ce post
         db.run("UPDATE posts SET reports = reports + 1 WHERE rowid = ?", [id]);
        
        // 2. Supprimer CE post s'il a >10 reports
         db.run("DELETE FROM posts WHERE rowid = ? AND reports > 10", [id]);
        
        res.json({success : true});
        
    } catch (error) {
        console.error('Erreur report:', error);
        res.json({success : false});
    }
});



app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://cdn.tailwindcss.com", 
                "https://open.spotify.com",
                "https://embed-cdn.spotifycdn.com" // ← AJOUT
            ],
            frameSrc: [
                "'self'",
                "https://www.youtube.com",
                "https://www.youtube-nocookie.com", // ← AJOUT
                "https://open.spotify.com", 
                "https://w.soundcloud.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://*.spotify.com"] // Peut aider
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Example app listening on port ${PORT}`)
})

function generateEmbedCode(url){

  if (url.includes('youtube.com') || url.includes('youtu.be')) {

    var id = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/mi)

    return `<iframe width="100%" height="360" src="https://www.youtube.com/embed/${id[1]}?rel=0&modestbranding=1" 
      picture-in-picture" allowfullscreen ></iframe>`;

  } else if (url.includes('spotify.com')) {

    var spotifyData = extractSpotifyId(url) 

    if (spotifyData) {
      // Embed selon le type
      if (spotifyData.type === 'track') {
        embedCode = `<iframe src="https://open.spotify.com/embed/track/${spotifyData.id}"   width="100%" height="360" frameborder="0"></iframe>`;
      } else if (spotifyData.type === 'playlist') {
        embedCode = `<iframe src="https://open.spotify.com/embed/playlist/${spotifyData.id}"   width="100%" height="360" frameborder="0"></iframe>`;
      }
      return embedCode
    } 
  } else if (url.includes('soundcloud.com')) {
    // SoundCloud a son propre système d'embed
      const encodedUrl = encodeURIComponent(url);
      return `<iframe width="100%" height="166" src="https://w.soundcloud.com/player/?url=${encodedUrl}"></iframe>`;


  } else {
    return `<a href='${url}'>${url}</>`
  }
  return url
}

function extractSpotifyId(url) {
  // Cherche l'ID après /track/ ou :track:
  const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/) || 
                     url.match(/spotify:track:([a-zA-Z0-9]+)/);
  
  const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/) || 
                        url.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  
  const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/) || 
                     url.match(/spotify:album:([a-zA-Z0-9]+)/);
  
  if (trackMatch) return { type: 'track', id: trackMatch[1] };
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };
  if (albumMatch) return { type: 'album', id: albumMatch[1] };
  
  return null;
}

// Dans server.js, avant d'insérer dans la DB
function sanitizeTitle(title) {
    if (!title || typeof title !== 'string') return '';
    
    // Limite la longueur
    title = title.trim().slice(0, 200);
    
    // Échappe les caractères spéciaux HTML
    return title.replace(/[<>"'&]/g, function(match) {
        return {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '&': '&amp;'
        }[match];
    });
}

function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    url = url.trim();
    
    // Whitelist des plateformes
    const allowedDomains = ['youtube.com', 'youtu.be', 'spotify.com', 'soundcloud.com'];
    
    try {
        const urlObj = new URL(url);
        
        // Vérifie le domaine
        const isAllowed = allowedDomains.some(domain => 
            urlObj.hostname.includes(domain)
        );
        
        if (!isAllowed) return null;
        
        // Protocoles sécurisés seulement
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return null;
        }
        
        // Retourne l'URL propre (new URL() a déjà nettoyé)
        return urlObj.toString();
        
    } catch (error) {
        return null;
    }
}