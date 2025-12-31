/**
 * Comprehensive Load Test Benchmark Suite
 * 
 * Tests tiered user scenarios (100, 500, 1000, 5000) with:
 * - Authenticated user flows with verified profiles
 * - Detailed metrics (latency, throughput, memory, CPU)
 * - Report generation in JSON and console format
 * 
 * Usage:
 *   k6 run ./load-test-benchmark.js -e SCENARIO=tier_100
 *   k6 run ./load-test-benchmark.js -e SCENARIO=tier_500
 *   k6 run ./load-test-benchmark.js -e SCENARIO=tier_1000
 *   k6 run ./load-test-benchmark.js -e SCENARIO=tier_5000
 *   k6 run ./load-test-benchmark.js -e SCENARIO=all_tiers
 * 
 * For JSON output:
 *   k6 run ./load-test-benchmark.js -e SCENARIO=tier_100 --out json=results_100.json
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend, Gauge } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const SCENARIO = __ENV.SCENARIO || "tier_100";
const PLATFORM_FEE = Number(__ENV.PLATFORM_FEE || 0);
const DEFAULT_CATEGORY = (__ENV.TEST_CATEGORY || "electronics").toLowerCase();

// Custom metrics for detailed reporting
const requestDuration = new Trend("custom_request_duration", true);
const requestErrors = new Rate("custom_error_rate");
const requestsPerSecond = new Counter("custom_requests_total");
const memoryUsage = new Gauge("server_memory_mb");
const cpuUsage = new Gauge("server_cpu_percent");
const authSuccessRate = new Rate("auth_success_rate");
const orderSuccessRate = new Rate("order_success_rate");

// Scenario configurations for different user tiers
const SCENARIOS = {
    tier_100: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "20s", target: 50 },
            { duration: "30s", target: 100 },
            { duration: "30s", target: 100 },
            { duration: "10s", target: 0 },
        ],
    },
    tier_500: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "30s", target: 100 },
            { duration: "30s", target: 300 },
            { duration: "30s", target: 500 },
            { duration: "30s", target: 500 },
            { duration: "15s", target: 0 },
        ],
    },
    tier_1000: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "30s", target: 200 },
            { duration: "30s", target: 500 },
            { duration: "45s", target: 1000 },
            { duration: "30s", target: 1000 },
            { duration: "15s", target: 0 },
        ],
    },
    tier_5000: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
            { duration: "45s", target: 500 },
            { duration: "45s", target: 1500 },
            { duration: "45s", target: 3000 },
            { duration: "45s", target: 5000 },
            { duration: "45s", target: 5000 },
            { duration: "30s", target: 0 },
        ],
    },
};

// All tiers sequential test with cooldown periods
const ALL_TIERS = {
    tier_100_phase: {
        executor: "ramping-vus",
        startVUs: 0,
        startTime: "0s",
        gracefulStop: "10s",
        stages: [
            { duration: "15s", target: 100 },
            { duration: "30s", target: 100 },
            { duration: "10s", target: 0 },
        ],
    },
    tier_500_phase: {
        executor: "ramping-vus",
        startVUs: 0,
        startTime: "1m",
        gracefulStop: "10s",
        stages: [
            { duration: "20s", target: 500 },
            { duration: "30s", target: 500 },
            { duration: "10s", target: 0 },
        ],
    },
    tier_1000_phase: {
        executor: "ramping-vus",
        startVUs: 0,
        startTime: "2m5s",
        gracefulStop: "15s",
        stages: [
            { duration: "25s", target: 1000 },
            { duration: "30s", target: 1000 },
            { duration: "15s", target: 0 },
        ],
    },
    tier_5000_phase: {
        executor: "ramping-vus",
        startVUs: 0,
        startTime: "3m20s",
        gracefulStop: "30s",
        stages: [
            { duration: "45s", target: 5000 },
            { duration: "45s", target: 5000 },
            { duration: "30s", target: 0 },
        ],
    },
};

export const options = {
    scenarios: SCENARIO === "all_tiers" ? ALL_TIERS : { default: SCENARIOS[SCENARIO] || SCENARIOS.tier_100 },
    thresholds: {
        http_req_failed: ["rate<0.05"],  // 5% error rate threshold
        "http_req_duration{method:GET}": ["p(95)<1000"],
        "http_req_duration{method:POST}": ["p(95)<2000"],
        custom_error_rate: ["rate<0.1"],
        auth_success_rate: ["rate>0.9"],
        order_success_rate: ["rate>0.8"],
    },
    summaryTrendStats: ["avg", "min", "med", "max", "p(50)", "p(75)", "p(90)", "p(95)", "p(99)"],
};

// Session and auth state per VU
const vuSessions = new Map();
const vuAuthState = new Map();
const vuUserData = new Map();

function createSession() {
    return { jar: new http.CookieJar() };
}

function getSession() {
    let session = vuSessions.get(__VU);
    if (!session) {
        session = createSession();
        vuSessions.set(__VU, session);
        vuAuthState.set(__VU, false);
    }
    return session;
}

function jsonHeaders(csrfToken) {
    const headers = { "Content-Type": "application/json" };
    if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
    }
    return headers;
}

function uniqueSuffix() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function randomDigits(length = 10) {
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += Math.floor(Math.random() * 10);
    }
    return out;
}

function fetchCsrfToken(session, label = "csrf") {
    const start = Date.now();
    const response = http.get(`${BASE_URL}/api/csrf-token`, {
        jar: session.jar,
        tags: { name: "GET /api/csrf-token", label },
    });

    const ok = check(response, {
        "csrf token fetched": (res) => res.status === 200,
    });

    requestDuration.add(Date.now() - start);
    requestsPerSecond.add(1);

    if (!ok) {
        requestErrors.add(1);
        return null;
    }

    return response.json("csrfToken");
}

// Test setup - Create verified test users for authenticated flows
export function setup() {
    console.log(`\n🚀 Starting load test benchmark - Scenario: ${SCENARIO}\n`);

    // Create a shop user with verified profile
    const shopSession = createSession();
    const shopSuffix = uniqueSuffix();
    const shopCredentials = {
        username: `loadtest_shop_${shopSuffix}`,
        password: `P@ss${shopSuffix}`,
    };

    // Register shop
    let csrfToken = fetchCsrfToken(shopSession, "shop-register");
    const shopRegPayload = {
        username: shopCredentials.username,
        password: shopCredentials.password,
        role: "shop",
        name: `Load Test Shop ${shopSuffix}`,
        phone: randomDigits(10),
        email: `shop.${shopSuffix}@loadtest.local`,
        language: "en",
    };

    let response = http.post(
        `${BASE_URL}/api/register`,
        JSON.stringify(shopRegPayload),
        {
            headers: jsonHeaders(csrfToken),
            jar: shopSession.jar,
            tags: { name: "POST /api/register", role: "shop" },
        }
    );

    if (response.status !== 201) {
        console.error(`Failed to register shop: ${response.status} ${response.body}`);
        return { error: "Shop registration failed" };
    }

    const shopUser = response.json();
    console.log(`✅ Registered shop user: ${shopCredentials.username} (ID: ${shopUser.id})`);

    // Update shop profile to verified status
    csrfToken = fetchCsrfToken(shopSession, "shop-profile");
    const shopProfilePayload = {
        name: `Load Test Shop ${shopSuffix}`,
        phone: shopRegPayload.phone,
        email: shopRegPayload.email,
        addressStreet: "42 Market Road",
        addressCity: "Chennai",
        addressState: "TN",
        addressPostalCode: "600034",
        addressCountry: "India",
        shopProfile: {
            shopName: `Load Test Shop ${shopSuffix}`,
            description: "Synthetic catalog for load testing purposes",
            businessType: "fashion",
            workingHours: {
                from: "09:00",
                to: "21:00",
                days: ["mon", "tue", "wed", "thu", "fri", "sat"],
            },
            shippingPolicy: "Ships within 48 hours domestically",
            returnPolicy: "30-day hassle-free returns",
        },
        pickupAvailable: true,
        deliveryAvailable: true,
        returnsEnabled: true,
        verificationStatus: "verified",
    };

    response = http.patch(
        `${BASE_URL}/api/users/${shopUser.id}`,
        JSON.stringify(shopProfilePayload),
        {
            headers: jsonHeaders(csrfToken),
            jar: shopSession.jar,
            tags: { name: "PATCH /api/users/:id", label: "shop-profile" },
        }
    );

    if (response.status !== 200) {
        console.warn(`⚠️ Shop profile update returned ${response.status}: ${response.body}`);
    } else {
        const updatedProfile = response.json();
        console.log(`✅ Shop profile updated - completeness: ${updatedProfile.profileCompleteness}%, verificationStatus: ${updatedProfile.verificationStatus}`);

        if (updatedProfile.profileCompleteness !== 100) {
            console.warn(`⚠️ Profile is only ${updatedProfile.profileCompleteness}% complete, verification requires 100%`);
        }
    }

    // Re-login to refresh session with updated verification status
    csrfToken = fetchCsrfToken(shopSession, "shop-relogin");
    response = http.post(
        `${BASE_URL}/api/login`,
        JSON.stringify({
            username: shopCredentials.username,
            password: shopCredentials.password,
        }),
        {
            headers: jsonHeaders(csrfToken),
            jar: shopSession.jar,
            tags: { name: "POST /api/login", label: "shop-relogin" },
        }
    );

    if (response.status === 200) {
        const refreshedUser = response.json();
        console.log(`✅ Re-logged in, verification status: ${refreshedUser.verificationStatus}`);
    } else {
        console.warn(`⚠️ Re-login failed: ${response.status} ${response.body}`);
    }

    // Create a test product
    csrfToken = fetchCsrfToken(shopSession, "create-product");
    const productPayload = {
        name: `Load Test Product ${uniqueSuffix()}`,
        description: "Synthetic item created for automated load testing",
        price: "499.00",
        mrp: "599.00",
        stock: 100000,
        category: DEFAULT_CATEGORY,
        images: ["https://placehold.co/600x400"],
        tags: ["loadtest"],
    };

    response = http.post(
        `${BASE_URL}/api/products`,
        JSON.stringify(productPayload),
        {
            headers: jsonHeaders(csrfToken),
            jar: shopSession.jar,
            tags: { name: "POST /api/products" },
        }
    );

    let product = null;
    if (response.status === 201) {
        product = response.json();
        console.log(`✅ Created test product: ${product.name} (ID: ${product.id})`);
    } else {
        console.warn(`⚠️ Product creation returned ${response.status}: ${response.body}`);
        // Product creation may fail due to verification - continue with anonymous tests
    }

    // Create customer credentials for anonymous tests to use
    // Create customer credentials and REGISTER the customer
    const customerSuffix = uniqueSuffix();
    const customerCredentials = {
        username: `loadtest_customer_${customerSuffix}`,
        password: `P@ss${customerSuffix}`,
    };

    // Register customer
    csrfToken = fetchCsrfToken(shopSession, "customer-register");
    const customerRegPayload = {
        username: customerCredentials.username,
        password: customerCredentials.password,
        role: "customer",
        name: `Load Test Customer ${customerSuffix}`,
        phone: randomDigits(10),
        email: `customer.${customerSuffix}@loadtest.local`,
        language: "en",
    };

    response = http.post(
        `${BASE_URL}/api/register`,
        JSON.stringify(customerRegPayload),
        {
            headers: jsonHeaders(csrfToken),
            jar: shopSession.jar, // Using shop session jar just to have a clean jar, strictly it's a new user
            tags: { name: "POST /api/register", role: "customer" },
        }
    );

    let customerUser = null;
    if (response.status === 201) {
        customerUser = response.json();
        console.log(`✅ Registered customer user: ${customerCredentials.username} (ID: ${customerUser.id})`);

        // Update customer profile to verified status (required for some actions)
        // Note: Re-using shop session for the initial setup steps for simplicity in maintaining cookies,
        // but for the customer update we might need to login as customer or just use the open endpoint if available.
        // Actually, the previous register call logged us in as the new customer in that jar.
        // Let's enable verification.

        csrfToken = fetchCsrfToken(shopSession, "customer-profile");
        const customerProfilePayload = {
            name: `Load Test Customer ${customerSuffix}`,
            phone: customerRegPayload.phone,
            email: customerRegPayload.email,
            verificationStatus: "verified",
        };

        response = http.patch(
            `${BASE_URL}/api/users/${customerUser.id}`,
            JSON.stringify(customerProfilePayload),
            {
                headers: jsonHeaders(csrfToken),
                jar: shopSession.jar,
                tags: { name: "PATCH /api/users/:id", label: "customer-profile" },
            }
        );

        if (response.status === 200) {
            console.log(`✅ Customer profile verified`);
        } else {
            console.warn(`⚠️ Customer profile verification failed: ${response.status}`);
        }

    } else {
        console.error(`Failed to register customer: ${response.status} ${response.body}`);
    }

    console.log(`\n📊 Test Configuration:`);
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   Scenario: ${SCENARIO}`);
    console.log(`   Product ID: ${product?.id || "N/A (anonymous tests only)"}`);
    console.log(`\n`);

    return {
        baseUrl: BASE_URL,
        shopCredentials,
        shopId: shopUser.id,
        customerCredentials,
        product: product ? {
            id: product.id,
            category: (product.category || DEFAULT_CATEGORY).toLowerCase(),
            price: Number.parseFloat(product.price),
        } : null,
    };
}

// Fetch server metrics from monitoring endpoint
function fetchServerMetrics(session) {
    try {
        const response = http.get(`${BASE_URL}/api/admin/monitoring/system`, {
            jar: session.jar,
            tags: { name: "GET /api/admin/monitoring/system" },
            timeout: "2s",
        });

        if (response.status === 200) {
            const data = response.json();
            if (data?.resources?.memory) {
                const heapMb = (data.resources.memory.heapUsedBytes || 0) / (1024 * 1024);
                memoryUsage.add(heapMb);
            }
            if (data?.resources?.cpu) {
                cpuUsage.add(data.resources.cpu.percent || 0);
            }
        }
    } catch (e) {
        // Monitoring endpoint may not be accessible
    }
}

// Test anonymous endpoints (no auth required)
function testAnonymousEndpoints(session) {
    group("Anonymous Access", () => {
        const start = Date.now();

        // Health check
        const healthRes = http.get(`${BASE_URL}/api/health`, {
            jar: session.jar,
            tags: { name: "GET /api/health" },
        });
        check(healthRes, { "health check ok": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(healthRes.timings.duration);
        if (healthRes.status >= 400) requestErrors.add(1);

        // Products listing (public)
        const productsRes = http.get(`${BASE_URL}/api/products`, {
            jar: session.jar,
            tags: { name: "GET /api/products" },
        });
        check(productsRes, { "products fetched": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(productsRes.timings.duration);
        if (productsRes.status >= 400) requestErrors.add(1);

        // Services listing (public)
        const servicesRes = http.get(`${BASE_URL}/api/services`, {
            jar: session.jar,
            tags: { name: "GET /api/services" },
        });
        check(servicesRes, { "services fetched": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(servicesRes.timings.duration);
        if (servicesRes.status >= 400) requestErrors.add(1);

        // Shops listing (public)
        const shopsRes = http.get(`${BASE_URL}/api/shops`, {
            jar: session.jar,
            tags: { name: "GET /api/shops" },
        });
        check(shopsRes, { "shops fetched": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(shopsRes.timings.duration);
        if (shopsRes.status >= 400) requestErrors.add(1);
    });
}

// Test search functionality
function testSearchEndpoints(session) {
    group("Search Operations", () => {
        const searchTerms = ["test", "product", "service", "shop", "fashion"];
        const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

        // Global search
        const searchRes = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(term)}&limit=10`, {
            jar: session.jar,
            tags: { name: "GET /api/search" },
        });
        check(searchRes, { "search completed": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(searchRes.timings.duration);
        if (searchRes.status >= 400) requestErrors.add(1);

        // Products with filters
        const filteredRes = http.get(`${BASE_URL}/api/products?category=${DEFAULT_CATEGORY}&minPrice=100&maxPrice=1000`, {
            jar: session.jar,
            tags: { name: "GET /api/products (filtered)" },
        });
        check(filteredRes, { "filtered products fetched": (r) => r.status === 200 });
        requestsPerSecond.add(1);
        requestDuration.add(filteredRes.timings.duration);
        if (filteredRes.status >= 400) requestErrors.add(1);
    });
}

// Session check endpoint
function testSessionCheck(session) {
    group("Session Check", () => {
        const res = http.get(`${BASE_URL}/api/user`, {
            jar: session.jar,
            tags: { name: "GET /api/user" },
        });
        // 401 is expected for unauthenticated, 200 for authenticated
        const ok = check(res, { "session check responded": (r) => r.status === 200 || r.status === 401 });
        requestsPerSecond.add(1);
        requestDuration.add(res.timings.duration);
        if (!ok) requestErrors.add(1);
    });
}

// Login customer
function loginCustomer(baseUrl, credentials, session) {
    const csrfToken = fetchCsrfToken(session, "customer-login");
    if (!csrfToken) {
        authSuccessRate.add(0);
        return false;
    }

    const response = http.post(
        `${baseUrl}/api/login`,
        JSON.stringify({
            username: credentials.username,
            password: credentials.password,
        }),
        {
            headers: jsonHeaders(csrfToken),
            jar: session.jar,
            tags: { name: "POST /api/login" },
        }
    );

    const ok = check(response, {
        "login successful": (res) => res.status === 200,
    });

    authSuccessRate.add(ok ? 1 : 0);
    requestsPerSecond.add(1);
    requestDuration.add(response.timings.duration);

    return ok;
}

// Browse catalog
function browseCatalog(baseUrl, category, session) {
    const productResponse = http.get(
        `${baseUrl}/api/products?category=${encodeURIComponent(category)}`,
        {
            jar: session.jar,
            tags: { name: "GET /api/products" },
        }
    );
    check(productResponse, { "products fetched": (res) => res.status === 200 });
    requestsPerSecond.add(1);
    requestDuration.add(productResponse.timings.duration);
}

// Submit order (if product exists)
function submitOrder(baseUrl, product, session) {
    const csrfToken = fetchCsrfToken(session, "create-order");
    if (!csrfToken || !product) {
        orderSuccessRate.add(0);
        return;
    }

    const subtotal = product.price;
    const total = (subtotal + PLATFORM_FEE).toFixed(2);
    const response = http.post(
        `${baseUrl}/api/orders`,
        JSON.stringify({
            items: [
                {
                    productId: product.id,
                    quantity: 1,
                    price: subtotal.toFixed(2),
                },
            ],
            subtotal: subtotal.toFixed(2),
            total,
            discount: "0",
            deliveryMethod: "delivery",
            paymentMethod: "upi",
        }),
        {
            headers: jsonHeaders(csrfToken),
            jar: session.jar,
            tags: { name: "POST /api/orders" },
        }
    );

    const ok = check(response, {
        "order created": (res) => res.status === 201,
    });

    if (!ok) {
        console.warn(`⚠️ Order creation failed: ${response.status} ${response.body}`);
    }

    orderSuccessRate.add(ok ? 1 : 0);
    requestsPerSecond.add(1);
    requestDuration.add(response.timings.duration);
}

// Main test function
export default function main(data) {
    const session = getSession();

    // Weight operations - more anonymous requests, fewer authenticated
    const operation = Math.random();

    if (operation < 0.4) {
        // 40% - Anonymous browsing
        testAnonymousEndpoints(session);
    } else if (operation < 0.6) {
        // 20% - Search operations
        testSearchEndpoints(session);
    } else if (operation < 0.75) {
        // 15% - Session checks
        testSessionCheck(session);
        fetchCsrfToken(session, "token-check");
    } else {
        // 25% - Catalog browsing with occasional order attempts
        if (data?.product) {
            // Ensure we are logged in as customer
            if (!vuAuthState.get(__VU)) {
                const loggedIn = loginCustomer(data.baseUrl, data.customerCredentials, session);
                vuAuthState.set(__VU, loggedIn);

                // If login failed, we can't do authenticated actions
                if (!loggedIn) return;
            }

            browseCatalog(data.baseUrl, data.product.category, session);

            // 10% chance to try order creation
            if (Math.random() < 0.1) {
                submitOrder(data.baseUrl, data.product, session);
            }
        } else {
            testAnonymousEndpoints(session);
        }
    }

    // Occasionally fetch server metrics (0.5% of requests)
    if (Math.random() < 0.005) {
        fetchServerMetrics(session);
    }

    // Variable think time between requests
    sleep(Math.random() * 0.5 + 0.1);
}

// Summary handler for detailed reporting
export function handleSummary(data) {
    const scenario = SCENARIO;
    const timestamp = new Date().toISOString();

    const summary = {
        scenario,
        timestamp,
        testDuration: data.state?.testRunDurationMs || 0,
        vus: {
            max: data.metrics.vus_max?.values?.max || 0,
        },
        requests: {
            total: data.metrics.http_reqs?.values?.count || 0,
            rate: (data.metrics.http_reqs?.values?.rate || 0).toFixed(2),
            failed: ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2),
        },
        latency: {
            avg: (data.metrics.http_req_duration?.values?.avg || 0).toFixed(2),
            min: (data.metrics.http_req_duration?.values?.min || 0).toFixed(2),
            med: (data.metrics.http_req_duration?.values?.med || 0).toFixed(2),
            max: (data.metrics.http_req_duration?.values?.max || 0).toFixed(2),
            p50: (data.metrics.http_req_duration?.values["p(50)"] || 0).toFixed(2),
            p75: (data.metrics.http_req_duration?.values["p(75)"] || 0).toFixed(2),
            p90: (data.metrics.http_req_duration?.values["p(90)"] || 0).toFixed(2),
            p95: (data.metrics.http_req_duration?.values["p(95)"] || 0).toFixed(2),
            p99: (data.metrics.http_req_duration?.values["p(99)"] || 0).toFixed(2),
        },
        dataTransfer: {
            receivedMB: ((data.metrics.data_received?.values?.count || 0) / 1024 / 1024).toFixed(2),
            sentMB: ((data.metrics.data_sent?.values?.count || 0) / 1024 / 1024).toFixed(2),
        },
        checks: {
            passed: data.metrics.checks?.values?.passes || 0,
            failed: data.metrics.checks?.values?.fails || 0,
            rate: ((data.metrics.checks?.values?.rate || 0) * 100).toFixed(2),
        },
        customMetrics: {
            errorRate: ((data.metrics.custom_error_rate?.values?.rate || 0) * 100).toFixed(2),
            authSuccessRate: ((data.metrics.auth_success_rate?.values?.rate || 0) * 100).toFixed(2),
            orderSuccessRate: ((data.metrics.order_success_rate?.values?.rate || 0) * 100).toFixed(2),
            serverMemoryMB: (data.metrics.server_memory_mb?.values?.value || 0).toFixed(2),
            serverCpuPercent: (data.metrics.server_cpu_percent?.values?.value || 0).toFixed(2),
        },
    };

    // Console report
    const report = `
================================================================================
                    LOAD TEST BENCHMARK REPORT - ${scenario.toUpperCase()}
================================================================================

📅 Timestamp: ${timestamp}
⏱️  Duration: ${(summary.testDuration / 1000).toFixed(1)}s

┌─────────────────────────────────────────────────────────────────────────────┐
│ 👥 VIRTUAL USERS                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Max VUs:        ${String(summary.vus.max).padEnd(10)}                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 REQUESTS                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Total:          ${String(summary.requests.total).padEnd(10)}                                       │
│ Rate:           ${summary.requests.rate} req/s                                           │
│ Failed:         ${summary.requests.failed}%                                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⏱️  LATENCY (ms)                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Average:        ${summary.latency.avg}ms                                              │
│ Median:         ${summary.latency.med}ms                                              │
│ P75:            ${summary.latency.p75}ms                                              │
│ P90:            ${summary.latency.p90}ms                                              │
│ P95:            ${summary.latency.p95}ms                                              │
│ P99:            ${summary.latency.p99}ms                                              │
│ Maximum:        ${summary.latency.max}ms                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 📦 DATA TRANSFER                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Received:       ${summary.dataTransfer.receivedMB} MB                                           │
│ Sent:           ${summary.dataTransfer.sentMB} MB                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ CHECKS                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Passed:         ${String(summary.checks.passed).padEnd(10)}                                       │
│ Failed:         ${String(summary.checks.failed).padEnd(10)}                                       │
│ Pass Rate:      ${summary.checks.rate}%                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔧 CUSTOM METRICS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Error Rate:     ${summary.customMetrics.errorRate}%                                               │
│ Auth Success:   ${summary.customMetrics.authSuccessRate}%                                              │
│ Order Success:  ${summary.customMetrics.orderSuccessRate}%                                              │
│ Server Memory:  ${summary.customMetrics.serverMemoryMB} MB                                         │
│ Server CPU:     ${summary.customMetrics.serverCpuPercent}%                                               │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
`;

    console.log(report);

    // Output files
    const jsonFileName = `benchmark_${scenario}_${Date.now()}.json`;

    return {
        stdout: report,
        [jsonFileName]: JSON.stringify(summary, null, 2),
    };
}
