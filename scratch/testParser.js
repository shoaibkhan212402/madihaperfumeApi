import fs from 'fs';

const html = fs.readFileSync('./scratch/imginn.html', 'utf8');

// Parse items
// Each item is inside: <div class="item">...</div> (containing image, link, stats, action etc.)
// Let's split by class="item" or use a regex to match all <div class="item">...</div> blocks.
// Note: Each <div class="item">...</div> has nested divs. Since regex doesn't parse nested tags perfectly, 
// we can match: <div class="item">([\s\S]*?)</div>\s*</div>
// Let's test that.

const items = [];
const itemRegex = /<div class="item">([\s\S]*?)<\/div>\s*<\/div>/g;
let match;

while ((match = itemRegex.exec(html)) !== null) {
  const itemHtml = match[1];
  
  // Extract code (e.g. href="/p/DZDAy6PSAFg/")
  const hrefMatch = itemHtml.match(/href="\/p\/([^"]+)\/"/);
  const code = hrefMatch ? hrefMatch[1] : null;
  const postUrl = code ? `https://www.instagram.com/p/${code}/` : 'https://www.instagram.com/madihaperfume_/';
  
  // Extract image src (e.g. src="https://..." or src="//...")
  // Note: some images are lazily loaded so they might have src or loading="lazy" src="..."
  const imgMatch = itemHtml.match(/<img[^>]+src="([^"]+)"/);
  let image = imgMatch ? imgMatch[1] : '';
  if (image.startsWith('//')) {
    image = 'https:' + image;
  }
  
  // Extract alt (caption)
  const altMatch = itemHtml.match(/alt="([^"]+)"/);
  const caption = altMatch ? altMatch[1] : '';
  
  // Extract likes
  const likesMatch = itemHtml.match(/<div class="likes">[\s\S]*?<span>(\d+)<\/span>/);
  const likes = likesMatch ? parseInt(likesMatch[1]) : 0;
  
  // Extract comments
  const commentsMatch = itemHtml.match(/<div class="comments">[\s\S]*?<span>(\d+)<\/span>/);
  const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;
  
  // Extract type
  let type = 'image';
  if (itemHtml.includes('icon-video')) {
    type = 'video';
  } else if (itemHtml.includes('icon-carousel')) {
    type = 'carousel';
  }
  
  if (code) {
    items.push({
      code,
      url: postUrl,
      image,
      caption: caption.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#38;/g, '&'),
      likes,
      comments,
      type
    });
  }
}

console.log('Parsed items count:', items.length);
console.log('Sample parsed item:', items[0]);
