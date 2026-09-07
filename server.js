const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for cross-origin frontend requests
app.use(cors());
app.use(express.json());

// Endpoint 1: Fetch Video Info / Metadata
app.get('/api/info', (req, res) => {
  const videoUrl = req.query.url;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'A valid URL query parameter is required.' });
  }

  // Use yt-dlp to extract JSON metadata without downloading
  const command = `yt-dlp --dump-json --no-warnings "${videoUrl}"`;

  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error(`yt-dlp exec error: ${stderr || error.message}`);
      return res.status(500).json({ error: 'Failed to extract video information.' });
    }

    try {
      const metadata = JSON.parse(stdout);
      const durationSec = metadata.duration || 0;
      
      // Convert seconds to MM:SS or HH:MM:SS format
      const formattedDuration = durationSec >= 3600
        ? new Date(durationSec * 1000).toISOString().substring(11, 19)
        : new Date(durationSec * 1000).toISOString().substring(14, 19);

      return res.json({
        title: metadata.title || 'Untitled Video',
        author: metadata.uploader || metadata.channel || 'Unknown Creator',
        thumbnail: metadata.thumbnail || '',
        duration: formattedDuration,
      });
    } catch (e) {
      console.error('JSON parsing error:', e);
      return res.status(500).json({ error: 'Error parsing media data.' });
    }
  });
});

// Endpoint 2: Stream & Download Media
app.get('/api/download', (req, res) => {
  const videoUrl = req.query.url;
  const format = req.query.format || 'mp4-1080';

  if (!videoUrl) {
    return res.status(400).send('URL is required');
  }

  let ytDlpArgs = [];

  if (format.startsWith('mp3')) {
    // Extract audio stream as MP3
    ytDlpArgs = [
      '-f', 'bestaudio',
      '-x', '--audio-format', 'mp3',
      '-o', '-', // Stream output to stdout
      videoUrl
    ];
    res.header('Content-Type', 'audio/mpeg');
    res.header('Content-Disposition', 'attachment; filename="audio.mp3"');
  } else {
    // Stream video up to requested height resolution
    const maxHeight = format.split('-')[1] || '1080';
    ytDlpArgs = [
      '-f', `bestvideo[height<=${maxHeight}]+bestaudio/best`,
      '--merge-output-format', 'mp4',
      '-o', '-', // Stream output to stdout
      videoUrl
    ];
    res.header('Content-Type', 'video/mp4');
    res.header('Content-Disposition', 'attachment; filename="video.mp4"');
  }

  // Spawn the child process and pipe directly to HTTP response
  const process = spawn('yt-dlp', ytDlpArgs);

  process.stdout.pipe(res);

  process.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  // Kill child process if user cancels download connection
  req.on('close', () => {
    process.kill();
  });
});

app.listen(PORT, () => {
  console.log(`Downloader backend running on port ${PORT}`);
});
