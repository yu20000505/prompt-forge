// 验证「自动打开浏览器」这步到底哪种写法在本机有效。
// 起一个日志监听端口，逐个尝试不同打开方式，看浏览器有没有真的连上来。
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 43250;
const hits = [];

const srv = http.createServer((req, res) => {
  hits.push(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>probe</h1>');
});
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
console.log(`探针已监听 http://127.0.0.1:${PORT}`);

const url = `http://127.0.0.1:${PORT}/probe`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const attempts = [
  ['cmd /c start "" url', () => spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()],
  ['explorer.exe url', () => spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref()],
  ['rundll32 url.dll', () => spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref()],
];

for (const [name, fn] of attempts) {
  const before = hits.length;
  try {
    fn();
  } catch (err) {
    console.log(`${name.padEnd(24)} 启动即抛错: ${err.message}`);
    continue;
  }
  await sleep(4000);
  const got = hits.length > before;
  console.log(`${name.padEnd(24)} ${got ? '成功，浏览器连上来了' : '没有请求到达'}`);
  if (got) break;
}

console.log('');
console.log('累计命中：', hits.length ? hits.join(' | ') : '无');
srv.close();
process.exit(0);
