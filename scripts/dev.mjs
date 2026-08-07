#!/usr/bin/env node
// Kehityskäynnistin: backend + frontend yhdellä komennolla (juuresta `npm run dev`).
// Nollariippuvuus — pelkkiä Noden sisäisiä moduuleja, jotta juureen ei synny node_modulesia.
//
// Backendissä ei ole dotenvia (config.ts lukee suoraan process.envin), joten juuren .env
// luetaan tässä ja välitetään lapsiprosesseille. Näin sama .env palvelee sekä Docker
// Composea että kehitysajoa.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- .env juuresta ---------------------------------------------------------
// Rivit muotoa KEY=VALUE. Kuoressa jo asetettu arvo voittaa tiedoston, jolloin yksittäisen
// muuttujan voi ylikirjoittaa kertaluontoisesti ilman .env:n muokkausta.
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue; // kommentit ja tyhjät rivit eivät täsmää
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv(path.join(root, '.env'));

// Kehityksen oletukset: HTTP-cookie ja dev-tila (index.ts sallii tällöin CORS:n Vitelle).
process.env.NODE_ENV ??= 'development';
process.env.COOKIE_SECURE ??= 'false';

const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Puuttuva ympäristömuuttuja: ${missing.join(', ')} — täytä juuren .env (malli .env.example).`);
  process.exit(1);
}

// Composen sisäverkon osoite ei näy hostista: db-palvelu ei julkaise porttia ulos.
if (/@db[:/]/.test(process.env.DATABASE_URL)) {
  console.warn('VAROITUS: DATABASE_URL osoittaa "db"-konttiin, joka ei näy hostista.');
  console.warn('Kehitysajossa osoite on localhost, esim. postgresql://kayttaja:salasana@localhost:5432/tietokanta');
}

// --- lapsiprosessit --------------------------------------------------------
const isWin = process.platform === 'win32';
// Windowsissa npm on .cmd-skripti, jota ei voi käynnistää suoraan (Node 20.12+). Kutsu
// kulkee cmd.exen kautta argumenttitaulukolla — `shell: true` tekisi saman mutta
// liittäisi argumentit merkkijonoksi ilman lainausta (DEP0190).
const [runner, runnerArgs] = isWin ? ['cmd.exe', ['/c', 'npm', 'run', 'dev']] : ['npm', ['run', 'dev']];
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27); // ANSI-ohjausmerkki värjäykseen
const paint = (code, s) => (useColor ? `${ESC}[${code}m${s}${ESC}[0m` : s);

const services = [
  { name: 'backend', dir: 'backend', color: 36 },
  { name: 'frontend', dir: 'frontend', color: 35 },
];

const children = [];
let shuttingDown = false;

// Rivittää lapsen tulosteen ja merkitsee sen palvelun nimellä. Osittainen rivi jää
// puskuriin seuraavaan chunkkiin asti, jotta merkintä ei katkaise riviä keskeltä.
function prefixer(name, color) {
  const tag = paint(color, `[${name}]`);
  let rest = '';
  return (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/);
    rest = lines.pop() ?? '';
    for (const line of lines) console.log(`${tag} ${line}`);
  };
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (isWin) {
      // Windowsissa kill() ei tavoita cmd.exen alle syntynyttä prosessipuuta.
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      // macOS/Linux: negatiivinen pid osoittaa prosessiryhmään, jolloin signaali menee
      // myös npm:n alle syntyneelle vitelle / ts-node-deville. Pelkkä child.kill()
      // tappaisi vain npm:n ja jättäisi portin varanneen lapsen henkiin.
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
  setTimeout(() => process.exit(code), 500).unref();
}

console.log(`Backend: http://localhost:${process.env.APP_PORT ?? 8080}   Frontend: http://localhost:5173`);
console.log('Avaa selaimeen frontendin osoite. Ctrl+C sammuttaa molemmat.\n');

for (const svc of services) {
  const dir = path.join(root, svc.dir);
  if (!existsSync(path.join(dir, 'node_modules'))) {
    console.error(`${svc.dir}/node_modules puuttuu — aja ensin: cd ${svc.dir} && npm install`);
    process.exit(1);
  }
  const child = spawn(runner, runnerArgs, {
    cwd: dir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Oma prosessiryhmä (ks. shutdown). Windowsissa ryhmätappo hoituu taskkillillä.
    detached: !isWin,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', prefixer(svc.name, svc.color));
  child.stderr.on('data', prefixer(svc.name, svc.color));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`\n${svc.name} sammui (${signal ?? code}) — pysäytetään myös toinen.`);
    shutdown(code ?? 1);
  });
  children.push({ ...svc, child });
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(0));
