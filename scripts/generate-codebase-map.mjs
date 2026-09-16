import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("🚀 Starting Automatic Codebase Architecture Map generation...");

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'codebase-map');
const GRAPH_JSON_PATH = path.join(OUTPUT_DIR, 'graph-data.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Run dependency-cruiser to generate JSON AST/dependency map
console.log("🔍 Scanning codebase with dependency-cruiser...");
try {
  // We scan client/src and server, ignore node_modules and dist
  const output = execSync(`npx depcruise client/src server --exclude "^(node_modules|dist|build)" --no-config --output-type json`, {
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'ignore'] // ignore stderr so warnings don't leak into json
  });
  fs.writeFileSync(GRAPH_JSON_PATH, output);
} catch (e) {
  console.log("⚠️ depcruise returned an error code, which might just mean it found circular dependencies. Continuing...");
  if (e.stdout) {
    fs.writeFileSync(GRAPH_JSON_PATH, e.stdout);
  }
}

console.log("📊 Parsing dependency data...");
const rawData = fs.readFileSync(GRAPH_JSON_PATH, 'utf-8');
let depData;
try {
  depData = JSON.parse(rawData);
} catch (e) {
  console.error("❌ Failed to parse dependency-cruiser output. Ensure dependency-cruiser is installed.");
  process.exit(1);
}

const modules = depData.modules || [];

// Calculate Importance (in-degree / how many times a file is imported)
const fileUsage = {};
const fileDependsOn = {};

modules.forEach(mod => {
  const source = mod.source;
  fileDependsOn[source] = mod.dependencies.map(d => d.resolved);
  
  mod.dependencies.forEach(dep => {
    if (!fileUsage[dep.resolved]) {
      fileUsage[dep.resolved] = [];
    }
    fileUsage[dep.resolved].push(source);
  });
});

const sortedByImportance = Object.keys(fileUsage)
  .filter(file => !file.includes('node_modules'))
  .sort((a, b) => fileUsage[b].length - fileUsage[a].length);

// 2. Generate architecture.md
console.log("📝 Generating architecture.md...");
const architectureMd = `# High-Level Architecture

## Overview
This project uses:
- **Frontend Framework**: React 19 + Vite + TypeScript
- **Backend/Database**: Supabase
- **State Management**: Zustand
- **Routing**: Wouter
- **Mobile**: Capacitor
- **Styling**: TailwindCSS

## Project Structure
- \`client/src/\`: Frontend React application.
  - \`components/\`: Reusable UI components.
  - \`pages/\`: Full page views for routing.
  - \`lib/\`: Utility functions and Supabase clients.
  - \`hooks/\`: Custom React hooks (React Query, Zustand).
- \`server/\`: Backend scripts and utilities.
- \`android/\`: Native capacitor project.
- \`supabase/\`: Database migrations and Edge functions.
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'architecture.md'), architectureMd);


// 3. Generate dependencies.md
console.log("📝 Generating dependencies.md...");
let depsMd = `# Dependency Report & Most Important Files\n\n`;
depsMd += `Ranked by number of incoming imports (how many other files depend on them).\n\n`;

sortedByImportance.slice(0, 50).forEach((file, index) => {
  depsMd += `### ${index + 1}. \`${file}\`\n`;
  depsMd += `- **Used by**: ${fileUsage[file].length} files\n`;
  depsMd += `- **Depends on**: ${fileDependsOn[file] ? fileDependsOn[file].length : 0} files\n`;
  if (fileUsage[file].length > 0) {
    depsMd += `- **Top importers**: \n`;
    fileUsage[file].slice(0, 5).forEach(importer => {
      depsMd += `  - \`${importer}\`\n`;
    });
  }
  depsMd += `\n`;
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'dependencies.md'), depsMd);

// 4. Generate file-tree.md
console.log("📝 Generating file-tree.md...");
let treeMd = `# File Tree Map\n\n`;
const directories = {};
modules.forEach(mod => {
  const parts = mod.source.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (!directories[dir]) directories[dir] = [];
  directories[dir].push(parts[parts.length - 1]);
});

Object.keys(directories).sort().forEach(dir => {
  if (!dir) return;
  treeMd += `### \`${dir}/\`\n`;
  directories[dir].sort().forEach(file => {
    treeMd += `- ${file}\n`;
  });
  treeMd += `\n`;
});
fs.writeFileSync(path.join(OUTPUT_DIR, 'file-tree.md'), treeMd);


// 5. Detect Routes (routes.md)
console.log("📝 Generating routes.md...");
let routesMd = `# Routing Map\n\n`;
routesMd += `Uses \`wouter\` for routing.\n\n`;
const appTsx = modules.find(m => m.source === 'client/src/App.tsx' || m.source === 'client/src/main.tsx');
if (appTsx) {
  try {
    const code = fs.readFileSync(path.resolve(process.cwd(), appTsx.source), 'utf-8');
    const routeRegex = /<Route\s+path=["']([^"']+)["']\s*(?:component={([^}]+)})?/g;
    let match;
    routesMd += `| Route | Component |\n|---|---|\n`;
    while ((match = routeRegex.exec(code)) !== null) {
      routesMd += `| \`${match[1]}\` | \`${match[2] || 'Children'}\` |\n`;
    }
  } catch(e) {}
}
fs.writeFileSync(path.join(OUTPUT_DIR, 'routes.md'), routesMd);

// 6. Database / API Map
console.log("📝 Generating api-map.md and database-map.md...");
let apiMd = `# API & External Services Map\n\n`;
let dbMd = `# Database Map\n\n`;

const supabaseFiles = modules.filter(m => m.dependencies.some(d => d.resolved.includes('supabase')));
apiMd += `## Files interacting with Supabase:\n`;
supabaseFiles.forEach(f => {
  apiMd += `- \`${f.source}\`\n`;
});

// Detect tables used
const tables = new Set();
modules.forEach(m => {
  try {
    const code = fs.readFileSync(path.resolve(process.cwd(), m.source), 'utf-8');
    const fromRegex = /\.from\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = fromRegex.exec(code)) !== null) {
      tables.add(match[1]);
    }
  } catch(e){}
});

dbMd += `## Supabase Tables Accessed from Client\n`;
Array.from(tables).sort().forEach(t => {
  dbMd += `- \`${t}\`\n`;
});

fs.writeFileSync(path.join(OUTPUT_DIR, 'api-map.md'), apiMd);
fs.writeFileSync(path.join(OUTPUT_DIR, 'database-map.md'), dbMd);

// 7. Generate architecture-issues.md
console.log("📝 Generating architecture-issues.md...");
let issuesMd = `# Potential Architecture Issues\n\n`;

// Deep dependencies
const deepDeps = modules.filter(m => m.dependencies.length > 20);
if (deepDeps.length > 0) {
  issuesMd += `## Large Files / High Coupling\nFiles with >20 imports. They might be doing too much:\n`;
  deepDeps.forEach(m => {
    issuesMd += `- \`${m.source}\` (${m.dependencies.length} imports)\n`;
  });
  issuesMd += `\n`;
}

// Circular dependencies (depcruise detects these in its summary)
if (depData.summary && depData.summary.violations) {
  const circular = depData.summary.violations.filter(v => v.rule.name.includes('circular'));
  if (circular.length > 0) {
    issuesMd += `## Circular Dependencies\n`;
    circular.forEach(c => {
      issuesMd += `- \`${c.from}\` -> \`${c.to}\`\n`;
    });
    issuesMd += `\n`;
  }
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'architecture-issues.md'), issuesMd);

// 8. Generate index.html (Interactive Explorer)
console.log("📝 Generating index.html (Interactive Explorer)...");
const nodes = [];
const edges = [];

modules.forEach(mod => {
  if (mod.source.includes('node_modules')) return;
  
  let group = 'other';
  if (mod.source.includes('components/')) group = 'component';
  else if (mod.source.includes('pages/')) group = 'page';
  else if (mod.source.includes('hooks/')) group = 'hook';
  else if (mod.source.includes('lib/')) group = 'lib';
  else if (mod.source.includes('services/')) group = 'service';

  nodes.push({
    id: mod.source,
    label: mod.source.split('/').pop(),
    title: mod.source,
    group: group
  });

  mod.dependencies.forEach(dep => {
    if (dep.resolved.includes('node_modules')) return;
    edges.push({
      from: mod.source,
      to: dep.resolved,
      arrows: 'to'
    });
  });
});

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Codebase Architecture Map</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: sans-serif; display: flex; height: 100vh; background: #0f172a; color: #f8fafc; }
    #network { flex: 1; height: 100%; }
    #sidebar { width: 350px; background: #1e293b; padding: 20px; overflow-y: auto; border-left: 1px solid #334155; box-sizing: border-box; }
    h1, h2, h3 { color: #f8fafc; margin-top: 0; }
    .prop-row { margin-bottom: 10px; }
    .prop-label { font-weight: bold; color: #94a3b8; font-size: 0.85em; text-transform: uppercase; }
    .prop-value { word-break: break-all; margin-top: 2px; }
    .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.8em; margin-right: 5px; margin-bottom: 5px; background: #334155; }
    .tag.component { background: #3b82f6; }
    .tag.page { background: #10b981; }
    .tag.hook { background: #f59e0b; }
    .tag.service { background: #8b5cf6; }
    a { color: #38bdf8; text-decoration: none; cursor: pointer; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div id="network"></div>
  <div id="sidebar">
    <h2>Codebase Map</h2>
    <p>Select a node to view details.</p>
    <div id="details" style="display:none;">
      <h3 id="d-name"></h3>
      <div class="prop-row"><div class="prop-label">Path</div><div class="prop-value" id="d-path"></div></div>
      <div class="prop-row"><div class="prop-label">Type</div><div class="prop-value"><span id="d-type" class="tag"></span></div></div>
      
      <div class="prop-row"><div class="prop-label">Used By (<span id="d-usedby-count">0</span>)</div>
        <div class="prop-value" id="d-usedby"></div>
      </div>
      
      <div class="prop-row"><div class="prop-label">Depends On (<span id="d-depends-count">0</span>)</div>
        <div class="prop-value" id="d-depends"></div>
      </div>
    </div>
  </div>

  <script>
    const nodesData = ${JSON.stringify(nodes)};
    const edgesData = ${JSON.stringify(edges)};
    
    // Create a network
    const container = document.getElementById('network');
    const data = { nodes: new vis.DataSet(nodesData), edges: new vis.DataSet(edgesData) };
    const options = {
      nodes: { shape: 'dot', size: 16, font: { color: '#f8fafc', size: 14, strokeWidth: 2, strokeColor: '#0f172a' } },
      edges: { color: { color: '#334155', highlight: '#94a3b8' }, smooth: { type: 'continuous' } },
      physics: { stabilization: false, barnesHut: { gravitationalConstant: -30000, centralGravity: 0.3, springLength: 95 } },
      groups: {
        component: { color: { background: '#3b82f6', border: '#2563eb' } },
        page: { color: { background: '#10b981', border: '#059669' } },
        hook: { color: { background: '#f59e0b', border: '#d97706' } },
        service: { color: { background: '#8b5cf6', border: '#7c3aed' } },
        lib: { color: { background: '#64748b', border: '#475569' } },
        other: { color: { background: '#94a3b8', border: '#64748b' } }
      }
    };
    const network = new vis.Network(container, data, options);

    // Sidebar logic
    const edgesList = edgesData;
    network.on('click', function (params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodesData.find(n => n.id === nodeId);
        
        document.getElementById('details').style.display = 'block';
        document.getElementById('d-name').innerText = node.label;
        document.getElementById('d-path').innerText = node.id;
        
        const typeEl = document.getElementById('d-type');
        typeEl.innerText = node.group;
        typeEl.className = 'tag ' + node.group;
        
        const dependsOn = edgesList.filter(e => e.from === nodeId).map(e => e.to);
        const usedBy = edgesList.filter(e => e.to === nodeId).map(e => e.from);
        
        document.getElementById('d-depends-count').innerText = dependsOn.length;
        document.getElementById('d-depends').innerHTML = dependsOn.map(id => \`<a onclick="network.selectNodes(['\${id}']); network.emit('click', {nodes: ['\${id}']})">\${id}</a><br>\`).join('');
        
        document.getElementById('d-usedby-count').innerText = usedBy.length;
        document.getElementById('d-usedby').innerHTML = usedBy.map(id => \`<a onclick="network.selectNodes(['\${id}']); network.emit('click', {nodes: ['\${id}']})">\${id}</a><br>\`).join('');
      } else {
        document.getElementById('details').style.display = 'none';
      }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), htmlContent);

// 9. README.md
console.log("📝 Generating README.md...");
const readmeMd = `# Codebase Architecture Map

This documentation and interactive map was automatically generated.

## Contents
1. **[Interactive Map](index.html)** - Open \`index.html\` in a browser or local server to view the interactive dependency graph.
2. **[Architecture](architecture.md)** - High-level system architecture.
3. **[Dependencies](dependencies.md)** - Ranked list of most important files.
4. **[File Tree](file-tree.md)** - Directory structure.
5. **[Routes](routes.md)** - Application routes map.
6. **[API Map](api-map.md)** - External API usage.
7. **[Database Map](database-map.md)** - Database tables used.
8. **[Architecture Issues](architecture-issues.md)** - Potential structural problems detected.

## How to regenerate
Run the following command from the project root:
\`\`\`bash
npm run codebase-map
\`\`\`
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readmeMd);

console.log("✅ Codebase Architecture Map generated successfully in docs/codebase-map/");
