import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormattedMessage } from '../src/components/FormattedMessage.tsx';

const render = content => renderToStaticMarkup(React.createElement(FormattedMessage, { content }));
test('chat renders Markdown with interactive code and scrollable tables', () => {
  const html = render('## Wynik\n\n**Gotowe**\n\n```sh\nnpm test\n```\n\n| Stan | Wynik |\n| --- | --- |\n| API | OK |');
  assert.match(html, /<h2>Wynik<\/h2>/);
  assert.match(html, /<strong>Gotowe<\/strong>/);
  assert.match(html, /<details class="message-code" open/);
  assert.match(html, /aria-label="Kopiuj kod"/);
  assert.match(html, /aria-label="Pobierz kod"/);
  assert.match(html, /role="region" aria-label="Tabela wiadomości"/);
  assert.match(html, /<table>/);
});
test('chat never embeds generated images, executable HTML or unsafe link protocols', () => {
  const html = render('![Grafika](https://example.com/image.png)\n\n[Uruchom](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(1)>\n```');
  assert.doesNotMatch(html, /<img|<script|href="javascript:/);
  assert.match(html, /href="https:\/\/example.com\/image.png"/);
  assert.match(html, /&lt;img/);
});
