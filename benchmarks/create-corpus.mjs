// Run only when intentionally preparing a NEW corpus version, before benchmarking.
// Kept as provenance for the original convenience-sample selection.
import { writeFile } from 'node:fs/promises';
const groups = {
  Bloomberg: [
    ['https://www.bloomberg.com/news/articles/2026-09-12/anthropic-ceo-says-it-s-time-to-slow-pace-of-improving-ai-models', null, 'previous_smoke_regression'],
    ['https://www.bloomberg.com/news/articles/2024-08-06/nvidia-nvda-blackwell-ai-chip-rollout-slowed-by-engineering-snags', 'Nvidia’s Next-Generation AI Chip Rollout Slowed by Engineering Snags'],
    ['https://www.bloomberg.com/news/articles/2024-06-02/jensen-huang-computex-keynote-nvidia-reveals-new-ai-software-and-services', 'Nvidia Unveils Next-Generation Rubin AI Platform for 2026'],
    ['https://www.bloomberg.com/news/articles/2024-03-18/nvidia-unveils-successor-to-its-all-conquering-ai-processor', 'Nvidia Looks to Extend AI Dominance With New Blackwell Chips'],
    ['https://www.bloomberg.com/news/articles/2024-02-13/nvidia-s-560-billion-rally-has-analysts-racing-to-boost-targets', 'Nvidia’s $560 Billion Gain Has Street Racing to Lift Targets']
  ],
  FT: [
    ['https://www.ft.com/content/20c07191-8da6-440f-b04b-8ea0ebdd9153', null, 'previous_smoke_regression'],
    ['https://www.ft.com/content/aa8a1be7-abe0-44b7-bcd3-31fd0a44de08', 'US tech stocks fall after big AI groups call for slowdown'],
    ['https://www.ft.com/content/4564e6a5-69e9-40a6-bf0f-a888f2f4f002', 'Anthropic tells investors it will be profitable for second straight quarter'],
    ['https://www.ft.com/content/cae60732-f929-4735-a627-db8c14e7c7ed', 'Trump rejects calls from tech bosses for AI slowdown'],
    ['https://www.ft.com/content/c765f312-e698-4d31-bf71-f64a656ad6f4', 'Musk’s secretive backer builds $40bn SpaceX stake']
  ],
  Guardian: [
    ['https://www.theguardian.com/science/2024/jan/11/amazon-archaeology-lost-cities-ecuador', 'Valley of lost cities that flourished 2,000 years ago found in Amazon'],
    ['https://www.theguardian.com/science/2024/jan/11/newly-discovered-cosmic-megastructure-challenges-theories-of-the-universe', 'Newly discovered cosmic megastructure challenges theories of the universe'],
    ['https://www.theguardian.com/science/2024/jan/11/penelope-rogers-obituary', 'Penelope Rogers obituary'],
    ['https://www.theguardian.com/science/2024/mar/02/doing-something-for-the-real-world-how-1000-uk-schoolkids-helped-crack-a-crystals-conundrum', '‘Doing something for the real world’: how 1,000 UK schoolkids helped crack a crystals conundrum'],
    ['https://www.theguardian.com/science/2024/mar/02/researchers-study-brain-activity-of-surgeons-for-signs-of-cognitive-overload', 'Researchers study brain activity of surgeons for signs of cognitive overload']
  ],
  AP: [
    ['https://apnews.com/article/be88e5a1fc018f2407536f1d6f6d3c10', 'A horse-shaped nebula gets its close-up in new photos by NASA’s Webb telescope'],
    ['https://apnews.com/article/4217d67977f95ead880835a71ecce098', 'Apple leaps into AI with an array of upcoming iPhone features and a ChatGPT deal to smarten up'],
    ['https://apnews.com/article/3bbf16e06e29f09320dcbefcf4ffc40b', 'Apple begins testing AI software designed to bring a smarter Siri to the iPhone 16'],
    ['https://apnews.com/article/d46b627cebfab90173a059c81bfeac1a', 'Apple launches the iPhone into the AI era with free software update'],
    ['https://apnews.com/article/fa72d5e7327edf285f79587e56e5b560', 'North Korea flies trash balloons over the South as leader Kim doubles down on satellite ambitions']
  ],
  NASA: [
    ['https://www.nasa.gov/image-article/webb-spots-a-starburst/', 'Webb Spots a Starburst', 'short_accessible_control'],
    ['https://www.nasa.gov/news-release/nasa-accelerates-space-exploration-earth-science-for-all-in-2024/', 'NASA Accelerates Space Exploration, Earth Science for All in 2024', 'long_accessible_control'],
    ['https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/', 'Webb Finds Evidence for Neutron Star at Heart of Young Supernova Remnant'],
    ['https://science.nasa.gov/blogs/webb/2024/05/30/nasas-james-webb-space-telescope-finds-most-distant-known-galaxy/', 'NASA’s James Webb Space Telescope Finds Most Distant Known Galaxy'],
    ['https://science.nasa.gov/missions/webb/in-odd-galaxy-nasas-webb-finds-potential-missing-link-to-first-stars/', 'In Odd Galaxy, NASA’s Webb Finds Potential Missing Link to First Stars']
  ]
};
const articles = [];
// Fixed round-robin publisher order prevents one publisher occupying all early slots.
for (let i = 0; i < 5; i++) for (const [publisher, entries] of Object.entries(groups)) {
  const [url, expected_title, selection = 'new_sample'] = entries[i];
  articles.push({ id: `${publisher.toLowerCase()}-${i + 1}`, publisher, url, expected_title, selection,
    discovery_source: publisher === 'FT' && i ? 'https://www.ft.com/technology' : url,
    discovery_method: selection === 'previous_smoke_regression' ? 'previous local smoke test, deliberately retained regression case' : publisher === 'FT' ? 'official technology index plus original subscription-page title' : 'official publisher search result or article page',
    ground_truth_full_text: null, expected_live_status: null });
}
await writeFile(new URL('./corpus.v1.json', import.meta.url), JSON.stringify({ version: 1, selected_at: new Date().toISOString(), selection_policy: 'Fixed convenience sample of 25 URLs, five per publisher, finalized before the first benchmark run. Two known smoke-test regression articles, four recent FT technology-index news links, archived-era Bloomberg Nvidia news, Guardian science-day links, AP technology/space news, and NASA short/long science controls. No archive availability filtering. Not random, not representative, and not a publisher-wide coverage estimate.', articles }, null, 2) + '\n', { flag: 'wx' });
