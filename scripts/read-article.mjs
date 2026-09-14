#!/usr/bin/env node
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { collectHtml, HTML_LIMITS } from './html-budget.mjs';
import { readArticle, extractArticle } from './article.mjs';

const usage = 'Usage: node scripts/read-article.mjs ORIGINAL_URL [--candidate PUBLIC_COPY_URL] [--title EXPECTED_TITLE] [--html FILE --source-url PUBLIC_SOURCE_URL] [--no-archives]';
try {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); process.exit(0); }
  const originalUrl = args.shift();
  if (!originalUrl || originalUrl.startsWith('--')) throw new Error('invalid_arguments');
  const options = {};
  while (args.length) {
    const key = args.shift();
    if (key === '--no-archives') { options.noArchives = true; continue; }
    const mapped = { '--candidate': 'candidate', '--title': 'expectedTitle', '--html': 'html', '--source-url': 'sourceUrl' }[key];
    if (!mapped || options[mapped] || !args.length || args[0].startsWith('--')) throw new Error('invalid_arguments');
    options[mapped] = args.shift();
  }
  if (!!options.html !== !!options.sourceUrl || (options.html && options.candidate)) throw new Error('invalid_arguments');
  let result;
  if (options.html) {
    if ((await stat(options.html)).size > HTML_LIMITS.maxInputBytes) throw new Error('html_file_too_large');
    const { body: html, processing } = await collectHtml(createReadStream(options.html));
    result = extractArticle(html, { originalUrl, sourceUrl: options.sourceUrl, expectedTitle: options.expectedTitle });
    result.attempts = [{ status: result.status, source_url: result.source_url, method: 'local_html', processing, provenance: 'user_or_agent_supplied_public_page' }];
  } else result = await readArticle(originalUrl, options);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const known = ['invalid_arguments','html_file_too_large','response_too_large','too_many_elements','unsafe_url'];
  console.log(JSON.stringify({ status: 'unavailable', error: known.includes(error.message) ? error.message : 'invalid_input_or_local_file', usage }));
  process.exitCode = 1;
}
