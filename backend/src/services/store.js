// Data layer: a very small JSON-file "database".
// Each collection is one file in backend/data (D1 produce, D2 requisitions,
// D3 zones ... from the Level 1 data flow diagram). Writes are queued so two
// requests can never write the same file at the same time, and each write
// goes to a temporary file first so a crash cannot leave half a file behind.
const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

const queues = new Map();

function fileFor(name) {
  return path.join(config.dataDir, `${name}.json`);
}

async function read(name) {
  try {
    return JSON.parse(await fs.readFile(fileFor(name), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function write(name, rows) {
  const file = fileFor(name);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
  await fs.rename(tmp, file);
}

// Run `fn` only after every earlier change to this collection has finished.
function serialise(name, fn) {
  const next = (queues.get(name) || Promise.resolve()).then(fn, fn);
  queues.set(name, next.catch(() => {}));
  return next;
}

function collection(name, key = 'id') {
  return {
    all: () => read(name),

    async find(id) {
      return (await read(name)).find((row) => row[key] === id) || null;
    },

    insert(row) {
      return serialise(name, async () => {
        const rows = await read(name);
        if (rows.some((r) => r[key] === row[key])) {
          const err = new Error(`${key} "${row[key]}" already exists`);
          err.status = 409;
          throw err;
        }
        rows.push(row);
        await write(name, rows);
        return row;
      });
    },

    update(id, patch) {
      return serialise(name, async () => {
        const rows = await read(name);
        const index = rows.findIndex((r) => r[key] === id);
        if (index === -1) return null;
        rows[index] = { ...rows[index], ...patch, [key]: id };
        await write(name, rows);
        return rows[index];
      });
    },

    remove(id) {
      return serialise(name, async () => {
        const rows = await read(name);
        const kept = rows.filter((r) => r[key] !== id);
        if (kept.length === rows.length) return false;
        await write(name, kept);
        return true;
      });
    },
  };
}

module.exports = {
  produce: collection('produce'),
  zones: collection('zones'),
  requisitions: collection('requisitions', 'ref'),
  growers: collection('growers', 'ref'),
  messages: collection('messages', 'ref'),
  users: collection('users', 'email'),
};
