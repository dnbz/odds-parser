import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "../redis.js";
import { defaultHandler, parseDetail } from "./parse.js";
import { proxyConfiguration } from "../proxies.js";

log.setLevel(log.LEVELS.INFO);

const PinnacleParser = class {
  urls = ["https://www.pinnacle.com/en/soccer/leagues"];

  constructor() {
    let router = createPlaywrightRouter();

    router.addDefaultHandler(defaultHandler);
    router.addHandler("DETAIL", parseDetail);

    this.crawler = new PlaywrightCrawler({
      requestHandler: router,
      // proxyConfiguration: proxyConfiguration,
      browserPoolOptions: {
        useFingerprints: false,
      }, // Uncomment this option to see the browser window.
      maxConcurrency: 3,
      maxRequestsPerMinute: 120,
    });

    this.crawler.redis = getRedisClient();
  }

  async start() {
    await this.crawler.redis.connect();
    await this.crawler.run(this.urls);
    await this.crawler.redis.disconnect();
  }
};

const parser = new PinnacleParser();
await parser.start();
