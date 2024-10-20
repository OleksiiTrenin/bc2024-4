const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { Command } = require('commander');
const superagent = require('superagent');

const program = new Command();
program
  .option('-h, --host <type>', 'адреса сервера')
  .option('-p, --port <number>', 'порт сервера')
  .option('-c, --cache <path>', 'шлях до кеш-директорії');

program.parse(process.argv);

const options = program.opts();
const cacheDir = path.resolve(options.cache);
const host = options.host;
const port = options.port;

if (!host || !port || !cacheDir) {
  console.error('Помилка: не задано обов`язкові параметри --host, --port та --cache.');
  process.exit(1);
}

// Функція для отримання шляху до зображення
const getImagePath = (httpCode) => path.join(cacheDir, `${httpCode}.jpg`);

async function fetchImageFromHttpCat(statusCode) {
  try {
    const response = await superagent.get(`https://http.cat/${statusCode}`);
    return response.body; // Відповідь повинна містити зображення
  } catch (err) {
    throw new Error('Не вдалося отримати картинку з http.cat');
  }
}

const server = http.createServer(async (req, res) => {
  const statusCode = req.url.slice(1); // Отримуємо статус-код з URL

  if (req.method === 'GET') {
    try {
      const image = await fs.readFile(getImagePath(statusCode));
      return res.writeHead(200, { 'Content-Type': 'image/jpg' }).end(image);
  } catch (err) {
      try {
          const response = await superagent.get(`https://http.cat/${statusCode}`);
          await fs.writeFile(getImagePath(statusCode), response.body); 
          return res.writeHead(200, { 'Content-Type': 'image/jpg' }).end(response.body);
      } catch (error) {
          console.error('Error while requesting to http.cat:', error.message);
          return res.writeHead(404).end('Image was not found on the external server');
      }
  }
  } else if (req.method === 'PUT') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', async () => {
      const fileData = Buffer.concat(body);
      const filePath = getImagePath(statusCode);
      try {
        await fs.writeFile(filePath, fileData);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('Created');
        console.log(`Зображення для коду ${statusCode} збережено до кешу.`);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
        console.error(`Помилка під час збереження зображення для коду ${statusCode}.`);
      }
    });
  } else if (req.method === 'DELETE') {
    const filePath = getImagePath(statusCode);
    try {
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      console.log(`Зображення для коду ${statusCode} видалено з кешу.`);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      console.error(`Зображення для коду ${statusCode} не знайдено в кеші для видалення.`);
    }
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    console.error(`Метод ${req.method} не підтримується.`);
  }
});

server.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
});
