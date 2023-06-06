import { createPlaywrightRouter, log, PlaywrightCrawler } from "crawlee";
import { getRedisClient } from "../redis.js";
import { defaultHandler, parseDetail } from "./parse.js";
import { pinnacleProxyConfiguration } from "../proxies.js";

log.setLevel(log.LEVELS.INFO);

const PinnacleParser = class {
  urls = ["https://www.pinnacle.com/en/soccer/leagues"];

  constructor() {
    let router = createPlaywrightRouter();

    router.addDefaultHandler(defaultHandler);
    router.addHandler("DETAIL", parseDetail);

    /** @type {PlaywrightCrawlerOptions} */
    const options = {
      requestHandler: router,
      browserPoolOptions: {
        useFingerprints: false,
      }, // Uncomment this option to see the browser window.
      maxConcurrency: 5,
      maxRequestsPerMinute: 240,
    };

    if (process.env.APP_ENV === "prod") {
      console.log("Using proxy configuration: ", pinnacleProxyConfiguration.proxyUrls)
      options.proxyConfiguration = pinnacleProxyConfiguration;

      // options.launchOptions = {
      //   headless: false,
      // };
    }

    this.crawler = new PlaywrightCrawler(options);

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
