import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { BrowserFingerprint } from "./browserFingerprint.js";

// Device settings
const iphone13 = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  viewport: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    isLandscape: false,
  },
};

// Constants
const COOKIES_FILE = "cookies.json";
const CONFIG = {
  COOKIE_REFRESH_INTERVAL: 30 * 60 * 1000, // 30 minutes (standardized timing)
  PAGE_TIMEOUT: 45000,
  MAX_RETRIES: 5,
  RETRY_DELAY: 10000,
  CHALLENGE_TIMEOUT: 10000,
  COOKIE_REFRESH_TIMEOUT: 2 * 60 * 1000, // 2 minutes timeout for cookie refresh
  MAX_REFRESH_RETRIES: 10, // Increased retries for enhanced retry system
  BROWSER_RESTART_TIMEOUT: 2 * 60 * 1000, // 2 minutes - when to restart browser
};

let browser = null;

/**
 * Gets a random location for browser fingerprinting
 */
function getRandomLocation() {
  const locations = [
    {
      locale: "en-US",
      timezone: "America/Los_Angeles",
      latitude: 34.052235,
      longitude: -118.243683,
    },
    {
      locale: "en-US",
      timezone: "America/New_York",
      latitude: 40.712776,
      longitude: -74.005974,
    },
    {
      locale: "en-US",
      timezone: "America/Chicago",
      latitude: 41.878113,
      longitude: -87.629799,
    },
    {
      locale: "en-US",
      timezone: "America/Denver",
      latitude: 39.739235,
      longitude: -104.99025,
    },
    {
      locale: "en-CA",
      timezone: "America/Toronto",
      latitude: 43.65107,
      longitude: -79.347015,
    },
    {
      locale: "en-GB",
      timezone: "Europe/London",
      latitude: 51.507351,
      longitude: -0.127758,
    },
  ];

  return locations[Math.floor(Math.random() * locations.length)];
}

/**
 * Generate a realistic iPhone user agent
 */
function getRealisticIphoneUserAgent() {
  const iOSVersions = [
    "15_0",
    "15_1",
    "15_2",
    "15_3",
    "15_4",
    "15_5",
    "15_6",
    "16_0",
    "16_1",
    "16_2",
  ];
  const version = iOSVersions[Math.floor(Math.random() * iOSVersions.length)];
  return `Mozilla/5.0 (iPhone; CPU iPhone OS ${version} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${
    version.split("_")[0]
  }.0 Mobile/15E148 Safari/604.1`;
}

/**
 * Enhance fingerprint with more browser properties
 */
function enhancedFingerprint() {
  const baseFingerprint = BrowserFingerprint.generate();

  // Add additional properties to make fingerprint more realistic
  return {
    ...baseFingerprint,
    webgl: {
      vendor: "Apple Inc.",
      renderer: "Apple GPU",
    },
    fonts: [
      "Arial",
      "Courier New",
      "Georgia",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
    ],
    plugins: [
      "PDF Viewer",
      "Chrome PDF Viewer",
      "Chromium PDF Viewer",
      "Microsoft Edge PDF Viewer",
      "WebKit built-in PDF",
    ],
    screen: {
      width: 390,
      height: 844,
      availWidth: 390,
      availHeight: 844,
      colorDepth: 24,
      pixelDepth: 24,
    },
    timezone: {
      offset: new Date().getTimezoneOffset(),
    },
  };
}

/**
 * Simulate various mobile interactions to appear more human-like
 */
async function simulateMobileInteractions(page) {
  try {
    // Get viewport size
    const viewport = await page.viewport();
    if (!viewport) return;

    // Random scroll amounts
    const scrollOptions = [
      { direction: "down", amount: 300 },
      { direction: "down", amount: 500 },
      { direction: "down", amount: 800 },
      { direction: "up", amount: 200 },
      { direction: "up", amount: 400 },
    ];

    // Pick 2-3 random scroll actions
    const scrollCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < scrollCount; i++) {
      const option =
        scrollOptions[Math.floor(Math.random() * scrollOptions.length)];

      // Scroll with a dynamic speed
      const scrollY =
        option.direction === "down" ? option.amount : -option.amount;
      await page.evaluate((y) => {
        window.scrollBy({
          top: y,
          behavior: "smooth",
        });
      }, scrollY);      // Random pause between scrolls (500-2000ms)
      await new Promise(resolve => setTimeout(resolve, 500 + Math.floor(Math.random() * 1500)));
    }

    // Simulate random taps/clicks (1-2 times)
    const tapCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < tapCount; i++) {
      // Random position within viewport
      const x = 50 + Math.floor(Math.random() * (viewport.width - 100));
      const y = 150 + Math.floor(Math.random() * (viewport.height - 300));

      await page.mouse.click(x, y);
      await new Promise(resolve => setTimeout(resolve, 500 + Math.floor(Math.random() * 1000)));
    }
  } catch (error) {
    console.warn("Error during mobile interaction simulation:", error.message);
  }
}

/**
 * Initialize the browser with enhanced fingerprinting
 */
async function initBrowser(proxy) {
  try {
    // Get randomized human-like properties
    const location = getRandomLocation();    // For persisting browser sessions, use same browser if possible
    if (!browser || !browser.isConnected()) {      // Launch options
      const launchOptions = {
        headless: 'new', // Set to false for debugging, true for production
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-ipc-flooding-protection",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-infobars",
          "--disable-notifications",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-default-apps",
          "--disable-hang-monitor",
          "--disable-prompt-on-repost",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--no-experiments",
          "--allow-running-insecure-content",
          "--ignore-certificate-errors",
          "--ignore-ssl-errors",
          "--ignore-certificate-errors-spki-list",
          "--disable-cors-policy",
          "--allow-cross-origin-auth-prompt",
          "--disable-site-isolation-trials",
          "--disable-features=TranslateUI"
        ],
        defaultViewport: null,
        timeout: 60000,
        ignoreDefaultArgs: ['--enable-automation'],
      };if (proxy && typeof proxy === "object" && (proxy.proxy || (proxy.host && proxy.port))) {
        try {
          let hostname, port;
          
          if (proxy.proxy) {
            // Extract hostname and port from proxy string
            const proxyString = proxy.proxy;

            // Ensure proxyString is a string before using string methods
            if (typeof proxyString !== "string") {
              throw new Error(
                "Invalid proxy format: proxy.proxy must be a string, got " +
                  typeof proxyString
              );
            }

            // Check if proxy string is in correct format (host:port)
            if (!proxyString.includes(":")) {
              throw new Error("Invalid proxy format: " + proxyString);
            }

            [hostname, port] = proxyString.split(":");
          } else if (proxy.host && proxy.port) {
            // Extract hostname and port from separate properties
            hostname = proxy.host;
            port = proxy.port.toString();
          } else {
            throw new Error("Invalid proxy configuration: missing host/port");
          }

          const portNum = parseInt(port) || 80;          launchOptions.args.push(`--proxy-server=http://${hostname}:${portNum}`);

          console.log(`Configuring browser with proxy: ${hostname}:${portNum}`);
          if (proxy.username && proxy.password) {
            console.log(`Proxy authentication will be configured with username: ${proxy.username}`);
          } else {
            console.warn(`Proxy configured but no authentication credentials provided`);
          }
        } catch (error) {
          console.warn(
            "Invalid proxy configuration, launching without proxy:",
            error
          );
        }
      }

      // Launch browser
      browser = await puppeteer.launch(launchOptions);
    }    // Create new page with enhanced fingerprinting
    const page = await browser.newPage();

    // Enable request interception for CORS handling
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const headers = request.headers();
      
      // Add CORS headers to requests
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      headers['Access-Control-Allow-Credentials'] = 'true';
      
      // Continue with modified headers
      request.continue({ headers });
    });

    page.on('response', async (response) => {
      try {
        // Add CORS headers to responses
        const headers = response.headers();
        if (!headers['access-control-allow-origin']) {
          await page.evaluate(() => {
            // Inject CORS headers into response handling
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              return originalFetch.apply(this, args).then(response => {
                // Create a new response with CORS headers
                const newResponse = new Response(response.body, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: {
                    ...response.headers,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
                    'Access-Control-Allow-Credentials': 'true'
                  }
                });
                return newResponse;
              });
            };
          });
        }
      } catch (error) {
        // Ignore errors in response handling
      }
    });// Configure proxy authentication if proxy credentials are provided
    if (proxy && proxy.username && proxy.password) {
      console.log(`Setting up proxy authentication for user: ${proxy.username}`);
      try {
        await page.authenticate({
          username: proxy.username,
          password: proxy.password,
        });
        console.log(`Proxy authentication configured successfully`);
      } catch (authError) {
        console.error(`Failed to configure proxy authentication: ${authError.message}`);
        throw new Error(`Proxy authentication failed: ${authError.message}`);
      }
    } else if (proxy) {
      console.warn(`Proxy configured but missing authentication credentials - this may cause auth errors`);
    }

    // Set user agent
    await page.setUserAgent(getRealisticIphoneUserAgent());

    // Set viewport to iPhone 13
    await page.setViewport({
      width: [375, 390, 414][Math.floor(Math.random() * 3)],
      height: [667, 736, 812, 844][Math.floor(Math.random() * 4)],
      deviceScaleFactor: 2 + Math.random() * 0.5,
      isMobile: true,
      hasTouch: true,
      isLandscape: false,
    });    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Accept-Language": `${location.locale},en;q=0.9`,
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      DNT: Math.random() > 0.5 ? "1" : "0",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Origin": "https://www.ticketmaster.com",
      "Referer": "https://www.ticketmaster.com/"
    });

    // Set geolocation
    await page.setGeolocation({
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: 100 * Math.random() + 50,
    });

    // Set timezone
    await page.emulateTimezone(location.timezone);

    // Set locale
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: ["dark", "light"][Math.floor(Math.random() * 2)] }
    ]);

    // Grant permissions
    const context = browser.defaultBrowserContext();
    await context.overridePermissions("https://www.ticketmaster.com", [
      "geolocation",
      "notifications",
      "microphone",
      "camera",
    ]);    // Add script to override webdriver detection and CORS policies
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Remove traces of automation
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      
      // Override CORS policies
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const [resource, config] = args;
        if (config) {
          config.mode = config.mode || 'cors';
          config.credentials = config.credentials || 'include';
        }
        return originalFetch.apply(this, args);
      };
      
      // Override XMLHttpRequest for CORS
      const originalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        xhr.open = function(method, url, async, user, password) {
          const result = originalOpen.apply(this, arguments);
          // Set CORS headers
          this.setRequestHeader = this.setRequestHeader || function() {};
          return result;
        };
        return xhr;
      };
      
      // Override document.domain for cross-origin access
      try {
        document.domain = 'ticketmaster.com';
      } catch (e) {
        // Ignore errors if domain cannot be set
      }
    });// Add waitForTimeout method to page if it doesn't exist
    if (!page.waitForTimeout) {
      page.waitForTimeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    }

    try {
      await page.waitForTimeout(1000 + Math.random() * 2000);
      await simulateMobileInteractions(page);
    } catch (simulationError) {
      console.warn("Error during initial simulation, continuing:", simulationError.message);
    }    return { 
      context: { 
        cookies: async () => await page.cookies(),
        addCookies: async (cookies) => await page.setCookie(...cookies),
        close: async () => await safeClosePage(page)
      }, 
      fingerprint: enhancedFingerprint(), 
      page, 
      browser 
    };
  } catch (error) {
    console.error("Error initializing browser:", error.message);
    throw error;
  }
}

/**
 * Handle Ticketmaster challenge pages (CAPTCHA, etc.)
 */
async function handleTicketmasterChallenge(page) {
  const startTime = Date.now();

  try {
    const challengePresent = await page
      .evaluate(() => {
        return document.body.textContent.includes(
          "Your Browsing Activity Has Been Paused"
        );
      })
      .catch(() => false); // Catch any navigation errors

    if (challengePresent) {
      console.log("Detected Ticketmaster challenge, attempting resolution...");
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      try {
        const viewportSize = page.viewportSize();
        if (viewportSize) {
          await page.mouse.move(
            Math.floor(Math.random() * viewportSize.width),
            Math.floor(Math.random() * viewportSize.height),
            { steps: 5 }
          );
        }
      } catch (moveError) {
        console.warn(
          "Mouse movement error in challenge, continuing:",
          moveError.message
        );
      }

      const buttons = await page.$$("button").catch(() => []);
      let buttonClicked = false;

      for (const button of buttons) {
        if (Date.now() - startTime > CONFIG.CHALLENGE_TIMEOUT) {
          console.warn("Challenge timeout, continuing without resolution");
          return false;
        }

        try {
          const text = await button.textContent();
          if (
            text?.toLowerCase().includes("continue") ||
            text?.toLowerCase().includes("verify")
          ) {
            await button.click();
            buttonClicked = true;
            break;
          }
        } catch (buttonError) {
          console.warn("Button click error, continuing:", buttonError.message);
          continue;
        }
      }

      if (!buttonClicked) {
        console.warn(
          "Could not find challenge button, continuing without resolution"
        );        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      const stillChallenged = await page
        .evaluate(() => {
          return document.body.textContent.includes(
            "Your Browsing Activity Has Been Paused"
          );
        })
        .catch(() => false);

      if (stillChallenged) {
        console.warn("Challenge not resolved, continuing without resolution");
        return false;
      }
    }
    return true;
  } catch (error) {
    console.warn("Challenge handling failed, continuing:", error.message);
    return false;
  }
}

/**
 * Check for Ticketmaster challenge page
 */
async function checkForTicketmasterChallenge(page) {
  try {
    // Check for CAPTCHA or other blocking mechanisms
    const challengeSelector = "#challenge-running"; // Example selector for CAPTCHA
    const isChallengePresent = (await page.$(challengeSelector)) !== null;

    if (isChallengePresent) {
      console.warn("Ticketmaster challenge detected");
      return true;
    }

    // Also check via text content
    const challengePresent = await page
      .evaluate(() => {
        return document.body.textContent.includes(
          "Your Browsing Activity Has Been Paused"
        );
      })
      .catch(() => false);

    return challengePresent;
  } catch (error) {
    console.error("Error checking for Ticketmaster challenge:", error);
    return false;
  }
}

/**
 * Capture cookies from the browser
 */
async function captureCookies(page, fingerprint) {
  let retryCount = 0;
  const MAX_RETRIES = 5;

  while (retryCount < MAX_RETRIES) {
    try {
      const challengePresent = await page
        .evaluate(() => {
          return document.body.textContent.includes(
            "Your Browsing Activity Has Been Paused"
          );
        })
        .catch(() => false);

      if (challengePresent) {
        console.log(
          `Attempt ${retryCount + 1}: Challenge detected during cookie capture`
        );

        const challengeResolved = await handleTicketmasterChallenge(page);
        if (!challengeResolved) {
          if (retryCount === MAX_RETRIES - 1) {
            console.log("Max retries reached during challenge resolution");
            return { cookies: null, fingerprint };
          }
          await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
          retryCount++;
          continue;
        }
      }

      // Get cookies from page
      let cookies = await page.cookies().catch(() => []);      if (!cookies?.length) {
        console.log(`Attempt ${retryCount + 1}: No cookies captured`);
        if (retryCount === MAX_RETRIES - 1) {
          return { cookies: null, fingerprint };
        }
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        retryCount++;
        continue;
      }

      // Filter out reCAPTCHA Google cookies
      cookies = cookies.filter(
        (cookie) =>
          !cookie.name.includes("_grecaptcha") &&
          !cookie.domain.includes("google.com")
      );

      // Check if we have enough cookies from ticketmaster.com
      const ticketmasterCookies = cookies.filter(
        (cookie) =>
          cookie.domain.includes("ticketmaster.com") ||
          cookie.domain.includes(".ticketmaster.com")
      );      if (ticketmasterCookies.length < 3) {
        console.log(
          `Attempt ${retryCount + 1}: Not enough Ticketmaster cookies`
        );
        if (retryCount === MAX_RETRIES - 1) {
          return { cookies: null, fingerprint };
        }
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        retryCount++;
        continue;
      }

      // Check JSON size
      const cookiesJson = JSON.stringify(cookies, null, 2);
      const lineCount = cookiesJson.split("\n").length;

      if (lineCount < 200) {
        console.log(
          `Attempt ${
            retryCount + 1
          }: Cookie JSON too small (${lineCount} lines)`
        );        if (retryCount === MAX_RETRIES - 1) {
          return { cookies: null, fingerprint };
        }
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        retryCount++;
        continue;
      }

      const oneHourFromNow = Date.now() + CONFIG.COOKIE_REFRESH_INTERVAL;
      cookies = cookies.map((cookie) => ({
        ...cookie,
        expires: oneHourFromNow / 1000,
        expiry: oneHourFromNow / 1000,
      }));

      // Add cookies one at a time with error handling
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (error) {
          console.warn(`Error adding cookie ${cookie.name}:`, error.message);
        }
      }

      // Save cookies to file
      await saveCookiesToFile(cookies);
      console.log(`Successfully captured cookies on attempt ${retryCount + 1}`);
      return { cookies, fingerprint };
    } catch (error) {
      console.error(
        `Error capturing cookies on attempt ${retryCount + 1}:`,
        error
      );      if (retryCount === MAX_RETRIES - 1) {
        return { cookies: null, fingerprint };
      }
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      retryCount++;
    }
  }

  return { cookies: null, fingerprint };
}

/**
 * Save cookies to a file
 */
async function saveCookiesToFile(cookies) {
  try {
    // Format the cookies with updated expiration
    const cookieData = cookies.map((cookie) => ({
      ...cookie,
      expires: cookie.expires || Date.now() + CONFIG.COOKIE_REFRESH_INTERVAL,
      expiry: cookie.expiry || Date.now() + CONFIG.COOKIE_REFRESH_INTERVAL,
    }));

    await fs.writeFile(COOKIES_FILE, JSON.stringify(cookieData, null, 2));
    console.log(`Saved ${cookies.length} cookies to ${COOKIES_FILE}`);
    return true;
  } catch (error) {
    console.error(`Error saving cookies to file: ${error.message}`);
    return false;
  }
}

/**
 * Load cookies from file
 */
async function loadCookiesFromFile() {
  try {
    const cookiesFile = path.join(process.cwd(), COOKIES_FILE);

    // Check if file exists
    try {
      await fs.access(cookiesFile);
    } catch (error) {
      console.log("Cookies file does not exist");
      return null;
    }

    // Read and parse
    const fileData = await fs.readFile(cookiesFile, "utf8");
    const cookies = JSON.parse(fileData);

    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.log("Invalid or empty cookies file");
      return null;
    }

    console.log(`Loaded ${cookies.length} cookies from file`);
    return cookies;
  } catch (error) {
    console.error(`Error loading cookies from file: ${error.message}`);
    return null;
  }
}

/**
 * Get fresh cookies by opening a browser and navigating to Ticketmaster
 */
/**
 * Enhanced cookie refresh function with 2-minute timeout retry system
 *
 * Features:
 * - 2-minute timeout for each refresh attempt
 * - On timeout: closes browser, gets new proxy, gets new event ID, opens fresh browser
 * - Up to 10 retry attempts with progressive backoff
 * - Comprehensive logging of retry process
 * - Database integration for alternative event IDs
 * - ProxyManager integration for alternative proxies
 */
async function refreshCookies(eventId, proxy = null) {
  let retryCount = 0;
  let lastError = null;
  let currentEventId = eventId;
  let currentProxy = proxy;

  console.log(`\n=== ENHANCED COOKIE REFRESH SYSTEM STARTED ===`);
  console.log(`Initial Event ID: ${currentEventId}`);
  console.log(
    `Initial Proxy: ${
      currentProxy ? `${currentProxy.host}:${currentProxy.port}` : "No proxy"
    }`
  );
  console.log(`Max Retries: ${CONFIG.MAX_REFRESH_RETRIES}`);
  console.log(
    `Timeout per attempt: ${CONFIG.BROWSER_RESTART_TIMEOUT / 1000} seconds`
  );
  console.log(`=== STARTING REFRESH ATTEMPTS ===\n`);

  while (retryCount <= CONFIG.MAX_REFRESH_RETRIES) {
    let localContext = null;
    let page = null;
    let browserInstance = null;
    let timeoutId = null;
    let refreshStartTime = Date.now();

    try {
      console.log(
        `Refreshing cookies using event ${currentEventId} (attempt ${
          retryCount + 1
        }/${CONFIG.MAX_REFRESH_RETRIES + 1})`
      );
      if (currentProxy) {
        console.log(`Using proxy: ${currentProxy.host}:${currentProxy.port}`);
      }

      // Try to load existing cookies first (only on first attempt)
      if (retryCount === 0) {
        const existingCookies = await loadCookiesFromFile();
        if (existingCookies && existingCookies.length >= 3) {
          const cookieAge = existingCookies[0]?.expiry
            ? existingCookies[0].expiry * 1000 - Date.now()
            : 0;

          if (cookieAge > 0 && cookieAge < CONFIG.COOKIE_REFRESH_INTERVAL) {
            console.log(
              `Using existing cookies (age: ${Math.floor(
                cookieAge / 1000 / 60
              )} minutes)`
            );
            return {
              cookies: existingCookies,
              fingerprint: BrowserFingerprint.generate(),
              lastRefresh: Date.now(),
            };
          }
        }
      }      // Create a promise that will be resolved/rejected based on timeout
      const refreshPromise = new Promise(async (resolve, reject) => {
        // Set up 2-minute timeout for browser restart
        console.log(`Setting up ${CONFIG.BROWSER_RESTART_TIMEOUT / 1000}s timeout for browser restart...`);
        timeoutId = setTimeout(() => {
          console.log(`Timeout triggered after ${CONFIG.BROWSER_RESTART_TIMEOUT / 1000} seconds`);
          reject(
            new Error(
              `Cookie refresh timeout after ${
                CONFIG.BROWSER_RESTART_TIMEOUT / 1000
              } seconds - browser restart required`
            )
          );
        }, CONFIG.BROWSER_RESTART_TIMEOUT);

        try {
          // Initialize browser with improved error handling
          let initAttempts = 0;
          let initSuccess = false;
          let initError = null;          while (initAttempts < 3 && !initSuccess) {
            try {
              const result = await initBrowser(currentProxy);
              if (!result || !result.context || !result.fingerprint) {
                throw new Error(
                  "Failed to initialize browser or generate fingerprint"
                );
              }

              browserInstance = result.browser;
              localContext = result.context;
              page = result.page;

              initSuccess = true;
            } catch (error) {
              initAttempts++;
              initError = error;
              console.error(
                `Browser init attempt ${initAttempts} failed:`,
                error.message
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * initAttempts)
              );
            }
          }

          if (!initSuccess) {
            console.error("All browser initialization attempts failed");
            throw initError || new Error("Failed to initialize browser");
          }          // Navigate to event page
          const url = `https://www.ticketmaster.com/event/${currentEventId}`;
          console.log(`Navigating to ${url}`);

          try {
            // Set additional headers before navigation
            await page.setExtraHTTPHeaders({
              ...page._extraHTTPHeaders,
              'Sec-Fetch-Site': 'same-origin',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-User': '?1',
              'Sec-Fetch-Dest': 'document'
            });

            await page.goto(url, {
              waitUntil: "domcontentloaded",
              timeout: CONFIG.PAGE_TIMEOUT,
            });
          } catch (navError) {
            console.warn(`Navigation error: ${navError.message}`);
            
            // If it's a CORS or proxy auth error, this is a critical failure
            if (navError.message.includes("ERR_INVALID_AUTH_CREDENTIALS")) {
              throw new Error(`Proxy authentication failed during navigation: ${navError.message}`);
            }
            
            if (navError.message.includes("CORS") || navError.message.includes("cross-origin")) {
              console.log("CORS error detected, trying alternative navigation...");
              
              // Try alternative navigation with different security settings
              try {
                await page.goto(url, {
                  waitUntil: "networkidle0",
                  timeout: CONFIG.PAGE_TIMEOUT,
                });
              } catch (corsError) {
                console.error(`CORS navigation failed: ${corsError.message}`);
                throw new Error(`Failed to navigate due to CORS issues: ${corsError.message}`);
              }
            } else {
              // Try with a different wait condition
              try {
                await page.goto(url, {
                  waitUntil: "networkidle0",
                  timeout: CONFIG.PAGE_TIMEOUT,
                });
              } catch (secondNavError) {
                console.error(`Second navigation attempt failed: ${secondNavError.message}`);
                throw new Error(`Failed to navigate to event page: ${secondNavError.message}`);
              }
            }
          }

          // Check if the page loaded properly
          const currentUrl = page.url();
          const pageLoadSuccessful = currentUrl.includes(
            `/event/${currentEventId}`
          );

          if (!pageLoadSuccessful) {
            console.warn(`Failed to load event page, URL: ${currentUrl}`);

            // Try refreshing the page
            console.log("Attempting to reload the page...");
            try {
              await page.reload({
                waitUntil: "domcontentloaded",
                timeout: CONFIG.PAGE_TIMEOUT,
              });
            } catch (reloadError) {
              console.warn(`Reload failed: ${reloadError.message}`);
              throw new Error(`Failed to load and reload event page: ${reloadError.message}`);
            }

            const newUrl = page.url();
            const reloadSuccessful = newUrl.includes(
              `/event/${currentEventId}`
            );

            if (!reloadSuccessful) {
              console.warn(`Reload failed, URL: ${newUrl}`);
              throw new Error("Failed to load Ticketmaster event page");
            }
          }

          console.log(`Successfully loaded page for event ${currentEventId}`);          // Check for Ticketmaster challenge
          const isChallengePresent = await checkForTicketmasterChallenge(page);
          if (isChallengePresent) {
            console.warn(
              "Detected Ticketmaster challenge page, attempting to resolve..."
            );
            await handleTicketmasterChallenge(page);
          }

          // Simulate human behavior
          try {
            await simulateMobileInteractions(page);
          } catch (behaviorError) {
            console.warn(`Human behavior simulation failed: ${behaviorError.message}`);
          }

          // Wait for cookies to be set
          await new Promise(resolve => setTimeout(resolve, 2000));          // Capture cookies
          const fingerprint = BrowserFingerprint.generate();
          console.log(`Starting cookie capture with fingerprint generated...`);
          const { cookies } = await captureCookies(page, fingerprint);

          if (!cookies || cookies.length === 0) {
            console.error("Cookie capture failed - no cookies returned");
            throw new Error("Failed to capture cookies");
          }

          console.log(`Cookie capture successful - ${cookies.length} cookies captured`);          // Clear timeout and resolve with success
          console.log(`Clearing timeout and resolving with success...`);
          clearTimeout(timeoutId);

          console.log(`\n=== COOKIE REFRESH SUCCESS ===`);
          console.log(`✓ Successfully refreshed ${cookies.length} cookies`);
          console.log(`✓ Event ID: ${currentEventId}`);
          console.log(
            `✓ Proxy: ${
              currentProxy
                ? `${currentProxy.host}:${currentProxy.port}`
                : "No proxy"
            }`
          );
          console.log(
            `✓ Attempt: ${retryCount + 1}/${CONFIG.MAX_REFRESH_RETRIES + 1}`
          );
          console.log(
            `✓ Duration: ${(Date.now() - refreshStartTime) / 1000} seconds`
          );
          console.log(`=== END SUCCESS REPORT ===\n`);

          resolve({
            cookies,
            fingerprint,
            lastRefresh: Date.now(),
          });        } catch (error) {
          console.log(`Error in refresh promise, clearing timeout:`, error.message);
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Wait for the refresh promise to complete
      const result = await refreshPromise;
      return result;
    } catch (error) {
      lastError = error;
      console.error(
        `Cookie refresh attempt ${retryCount + 1} failed: ${error.message}`
      );

      // Check if this was a timeout error (2-minute browser restart timeout)
      const isBrowserRestartTimeout = error.message.includes(
        "browser restart required"
      );
      const isGeneralTimeout = error.message.includes("timeout");

      if (
        (isBrowserRestartTimeout || isGeneralTimeout) &&
        retryCount < CONFIG.MAX_REFRESH_RETRIES
      ) {
        console.log(`\n=== COOKIE REFRESH TIMEOUT DETECTED ===`);
        console.log(
          `Timeout occurred after ${
            (Date.now() - refreshStartTime) / 1000
          } seconds`
        );
        console.log(`Implementing enhanced retry system:`);
        console.log(`1. Closing existing browser`);
        console.log(`2. Getting new proxy`);
        console.log(`3. Getting new event ID`);
        console.log(`4. Opening fresh browser instance`);        // Step 1: Force close existing browser to ensure clean restart
        try {
          if (browserInstance) {
            console.log(`Forcefully closing existing browser...`);
            await browserInstance.close();
            browserInstance = null;
          }
          // Also close global browser if it exists
          if (browser) {
            console.log(`Closing global browser instance...`);
            await browser.close();
            browser = null;
          }
        } catch (closeError) {
          console.warn(`Error closing browser: ${closeError.message}`);
        }

        // Step 2: Get a new proxy for retry
        try {
          const newProxy = await getAlternativeProxy(currentProxy);
          if (newProxy && newProxy !== currentProxy) {
            console.log(
              `✓ New proxy obtained: ${newProxy.host}:${newProxy.port}`
            );
            currentProxy = newProxy;
          } else {
            console.log(
              `⚠ Could not get new proxy, will retry with current proxy`
            );
          }
        } catch (proxyError) {
          console.warn(`Error getting new proxy: ${proxyError.message}`);
        }

        // Step 3: Generate a new event ID for retry
        try {
          const newEventId = await generateAlternativeEventId(currentEventId);
          if (newEventId && newEventId !== currentEventId) {
            console.log(`✓ New event ID obtained: ${newEventId}`);
            currentEventId = newEventId;
          } else {
            console.log(
              `⚠ Could not get new event ID, will retry with current event`
            );
          }
        } catch (eventError) {
          console.warn(`Error getting new event ID: ${eventError.message}`);
        }

        console.log(`=== RETRY SETUP COMPLETE ===\n`);
      }

      retryCount++;

      // If we've exhausted all retries, throw the last error
      if (retryCount > CONFIG.MAX_REFRESH_RETRIES) {
        console.error(`\n=== ALL COOKIE REFRESH ATTEMPTS FAILED ===`);
        console.error(
          `Failed after ${CONFIG.MAX_REFRESH_RETRIES + 1} attempts`
        );
        console.error(
          `Total time elapsed: ${
            (Date.now() - refreshStartTime) / 1000
          } seconds`
        );
        console.error(`Last error: ${lastError.message}`);
        console.error(`=== END FAILURE REPORT ===\n`);
        throw lastError;
      }

      // Wait before retrying (progressive backoff)
      const waitTime = CONFIG.RETRY_DELAY * Math.min(retryCount, 3); // Cap at 3x base delay
      console.log(
        `Waiting ${waitTime / 1000} seconds before retry ${retryCount + 1}...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));    } finally {
      // Close page and context safely
      await safeClosePage(page);
      await safeCloseContext(localContext);
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error("Cookie refresh failed after all retries");
}

/**
 * Generate an alternative event ID for retry attempts
 * This function queries the database for a different active event
 */
async function generateAlternativeEventId(originalEventId) {
  try {
    console.log(
      `Searching for alternative event ID (original: ${originalEventId})...`
    );    // Try to import Event model and get a different random event
    try {
      const { Event } = await import("../models/eventModel.js");

      // Get multiple random active events, excluding the original
      const alternativeEvents = await Event.aggregate([
        {
          $match: {
            Skip_Scraping: { $ne: true },
            url: { $exists: true, $ne: "" },
            Event_ID: { $ne: originalEventId }, // Exclude the original event
          },
        },
        { $sample: { size: 10 } }, // Get 10 random alternatives
        { $project: { Event_ID: 1, url: 1, Event_Name: 1 } },
      ]);

      if (alternativeEvents && alternativeEvents.length > 0) {
        // Select one random event from the results
        const selectedEvent =
          alternativeEvents[
            Math.floor(Math.random() * alternativeEvents.length)
          ];
        const alternativeId = selectedEvent.Event_ID;

        console.log(
          `✓ Found alternative event: ${alternativeId} (${
            selectedEvent.Event_Name || "Unknown Event"
          })`
        );        return alternativeId;
      } else {
        console.warn(`No alternative events found in database`);
        return originalEventId;
      }
    } catch (dbError) {
      console.warn(`Database query failed: ${dbError.message}`);
      return originalEventId;
    }
  } catch (error) {
    console.warn(`Failed to generate alternative event ID: ${error.message}`);
    return originalEventId;
  }
}

/**
 * Get an alternative proxy for retry attempts
 * This function integrates with the proxy list to get a fresh proxy
 */
async function getAlternativeProxy(currentProxy) {
  try {
    console.log(`Searching for alternative proxy...`);    // Try to get a fresh proxy from the proxy management system
    try {      const proxyData = await import("../proxy.js");
      const proxies = proxyData.default.proxies;

      if (proxies && proxies.length > 0) {
        // Filter out the current proxy if it exists
        let availableProxies = proxies;
        if (currentProxy && currentProxy.proxy) {
          availableProxies = proxies.filter(p => p.proxy !== currentProxy.proxy);
        }

        // If we have alternative proxies, pick a random one
        if (availableProxies.length > 0) {
          const randomProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
          
          // Parse proxy string to get host and port
          const [host, port] = randomProxy.proxy.split(':');
          
          const newProxy = {
            host: host,
            port: port,
            username: randomProxy.username,
            password: randomProxy.password,
            proxy: randomProxy.proxy,
          };

          console.log(`✓ Found alternative proxy: ${newProxy.host}:${newProxy.port}`);
          return newProxy;
        } else {
          console.log(`⚠ No alternative proxies available in proxy list`);
        }
      }
    } catch (proxyError) {      console.warn(`Failed to get proxy from proxy list: ${proxyError.message}`);
    }    console.warn(`Could not generate alternative proxy`);
    return null;
  } catch (error) {
    console.warn(`Failed to get alternative proxy: ${error.message}`);
    return null;
  }
}

/**
 * Clean up browser resources
 */
async function cleanup() {
  if (browser) {
    try {
      if (browser.isConnected()) {
        await browser.close();
      }
      browser = null;
    } catch (error) {
      // Ignore common browser closure errors
      if (!error.message.includes('Protocol error') && 
          !error.message.includes('Connection closed') &&
          !error.message.includes('Target closed')) {
        console.warn("Error closing browser:", error.message);
      }
      browser = null; // Set to null regardless
    }
  }
}

/**
 * Safely close a page, ignoring common closure errors
 */
async function safeClosePage(page) {
  if (!page) return;
  
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (error) {
    // Ignore common page closure errors that happen when the page is already closed
    if (!error.message.includes('Protocol error') && 
        !error.message.includes('Connection closed') &&
        !error.message.includes('Target closed') &&
        !error.message.includes('Session closed')) {
      console.warn("Error closing page:", error.message);
    }
  }
}

/**
 * Safely close a browser context, ignoring common closure errors
 */
async function safeCloseContext(context) {
  if (!context || !context.close) return;
  
  try {
    await context.close();
  } catch (error) {
    // Ignore common context closure errors
    if (!error.message.includes('Protocol error') && 
        !error.message.includes('Connection closed') &&
        !error.message.includes('Target closed') &&
        !error.message.includes('Session closed')) {
      console.warn("Error closing context:", error.message);
    }
  }
}

export {
  initBrowser,
  captureCookies,
  refreshCookies,
  loadCookiesFromFile,
  saveCookiesToFile,
  cleanup,  handleTicketmasterChallenge,
  checkForTicketmasterChallenge,
  enhancedFingerprint,
  getRandomLocation,
  getRealisticIphoneUserAgent,
  generateAlternativeEventId,
  getAlternativeProxy,
  simulateMobileInteractions,
  safeClosePage,
  safeCloseContext,
};
