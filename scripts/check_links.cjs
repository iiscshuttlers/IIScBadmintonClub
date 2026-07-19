const fs = require('fs');
const glob = require('glob');

const routes = [
  '/', '/pulse', '/tv', '/tv/:matchId', '/hub', '/legacy', '/hall-of-fame', '/gallery',
  '/events/:slug', '/join', '/player/:id', '/player/:id/personal', '/compare/:p1/:p2',
  '/doubles/:p1/:p2', '/marketplace', '/exchange', '/find-lost', '/umpire', '/privacy',
  '/terms', '/admin', '/tournament-admin', '/profile/setup', '/player/:id/edit',
  '/profile/password', '/delete-account', '/personal', '/personal/me', '/personal/player/:id',
  '/broadcast/:matchId', '/404'
];

function matchRoute(link) {
  if (link.includes('?')) link = link.split('?')[0];
  if (link.includes('#')) link = link.split('#')[0];
  
  if (routes.includes(link)) return true;
  
  for (const route of routes) {
    if (!route.includes(':')) continue;
    
    const routeParts = route.split('/');
    const linkParts = link.split('/');
    
    if (routeParts.length !== linkParts.length && !route.endsWith('/*?')) continue;
    if (route.endsWith('/*?') && linkParts.length >= routeParts.length) {
      let isMatch = true;
      for (let i = 0; i < routeParts.length - 1; i++) {
        if (routeParts[i] !== linkParts[i] && !routeParts[i].startsWith(':')) {
          isMatch = false;
        }
      }
      if (isMatch) return true;
    }
    
    let isMatch = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i] !== linkParts[i] && !routeParts[i].startsWith(':')) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) return true;
  }
  return false;
}

const files = glob.sync('client/src/**/*.{ts,tsx}');
const brokenLinks = new Set();
let totalLinks = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  const matches = [...content.matchAll(/href=["'](\/[^"']+)["']/g), ...content.matchAll(/to=["'](\/[^"']+)["']/g), ...content.matchAll(/setLocation\(['"](\/[^'"]+)['"]\)/g)];
  
  for (const match of matches) {
    const link = match[1];
    totalLinks++;
    if (!matchRoute(link)) {
      brokenLinks.add(`${link} (in ${file})`);
    }
  }
}

console.log(`Checked ${totalLinks} internal links.`);
console.log('Broken Links found:');
for (const link of brokenLinks) {
  console.log(link);
}
