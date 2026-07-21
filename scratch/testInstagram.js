import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://imginn.com/madihaperfume_/';

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    fs.writeFileSync('./scratch/imginn.html', data);
    console.log('Saved html to scratch/imginn.html, length:', data.length);
  });
}).on('error', (err) => {
  console.error('Error fetching URL:', err);
});
