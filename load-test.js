import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const PLATFORM_FEE = Number(__ENV.PLATFORM_FEE || 1);
const DEFAULT_CATEGORY = (__ENV.TEST_CATEGORY || "electronics").toLowerCase();
const ENABLE_REG_SPIKE =
  String(__ENV.ENABLE_REG_SPIKE || "false").toLowerCase() === "true";

const vuSessions = new Map();
const vuAuthState = new Map();

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 100 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{method:GET}": ["p(95)<500"],
  },
};

function createSession() {
  return { jar: new http.CookieJar() };
}

function jsonHeaders(csrfToken) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return headers;
}

function fetchCsrfToken(session, label = "csrf-token") {
  const jar = session?.jar ?? http.cookieJar();
  const response = http.get(`${BASE_URL}/api/csrf-token`, {
    jar,
    tags: { name: "GET /api/csrf-token", label },
  });

  const ok = check(response, {
    [`${label} token fetched`]: (res) =>
      res.status === 200 && typeof res.json("csrfToken") === "string",
  });
  if (!ok) {
    throw new Error(`Unable to fetch CSRF token for ${label}: ${response.body}`);
  }
  return response.json("csrfToken");
}

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function randomDigits(length = 10) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10);
  }
  return out;
}

function registerUserWithRole(role, session) {
  const suffix = uniqueSuffix();
  const password = `P@ss${suffix}`;
  const payload = {
    username: `${role}_${suffix}`,
    password,
    role,
    name: `${role} ${suffix}`,
    phone: randomDigits(10),
    email: `${role}.${suffix}@example.com`,
    language: "en",
  };

  const csrfToken = fetchCsrfToken(session, `${role}-register`);
  const response = http.post(
    `${BASE_URL}/api/register`,
    JSON.stringify(payload),
    {
      headers: jsonHeaders(csrfToken),
      jar: session.jar,
      tags: { name: "POST /api/register", role },
    },
  );

  const ok = check(response, {
    [`${role} registered`] : (res) => res.status === 201,
  });
  if (!ok) {
    throw new Error(
      `Failed to register ${role}: ${response.status} ${response.body}`,
    );
  }

  return {
    session,
    user: response.json(),
    credentials: { username: payload.username, password },
    seed: payload,
  };
}

function updateUserProfile(account, payload, label) {
  const csrfToken = fetchCsrfToken(account.session, label);
  const response = http.patch(
    `${BASE_URL}/api/users/${account.user.id}`,
    JSON.stringify(payload),
    {
      headers: jsonHeaders(csrfToken),
      jar: account.session.jar,
      tags: { name: "PATCH /api/users/:id", label },
    },
  );

  const ok = check(response, {
    [`${label} updated`]: (res) => res.status === 200,
  });
  if (!ok) {
    throw new Error(
      `Failed to update profile for ${label}: ${response.status} ${response.body}`,
    );
  }
  account.user = response.json();
  return account.user;
}

function providerWorkingHours() {
  return JSON.stringify({
    from: "09:00",
    to: "18:00",
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
  });
}

function shopProfilePayload(nameSuffix) {
  return {
    shopName: `Load Test Shop ${nameSuffix}`,
    description: "Synthetic catalog for load testing purposes.",
    businessType: "fashion",
    workingHours: {
      from: "09:00",
      to: "21:00",
      days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    },
    shippingPolicy: "Ships within 48 hours domestically.",
    returnPolicy: "30-day hassle-free returns.",
  };
}

function serviceWorkingHours() {
  const build = (start = "09:00", end = "17:00") => ({
    isAvailable: true,
    start,
    end,
  });
  const closed = { isAvailable: false, start: "", end: "" };
  return {
    monday: build(),
    tuesday: build(),
    wednesday: build(),
    thursday: build(),
    friday: build(),
    saturday: build("10:00", "16:00"),
    sunday: closed,
  };
}

function verifyCustomerProfile(account) {
  updateUserProfile(
    account,
    {
      name: account.seed.name,
      phone: account.seed.phone,
      email: account.seed.email,
      addressStreet: "10 Customer Street",
      addressCity: "Chennai",
      addressState: "TN",
      addressPostalCode: "600001",
      addressCountry: "India",
      language: "en",
      verificationStatus: "verified",
    },
    "customer-profile",
  );
}

function verifyProviderProfile(account) {
  updateUserProfile(
    account,
    {
      name: `Provider ${account.seed.username}`,
      phone: account.seed.phone,
      email: account.seed.email,
      addressStreet: "18 Wellness Lane",
      addressCity: "Bengaluru",
      addressState: "KA",
      addressPostalCode: "560001",
      addressCountry: "India",
      bio: "Certified therapist focused on automated load tests.",
      qualifications: "Nationally Certified Therapist",
      experience: "5 years running simulated sessions",
      workingHours: providerWorkingHours(),
      languages: "English,Hindi",
      verificationStatus: "verified",
    },
    "provider-profile",
  );
}

function verifyShopProfile(account) {
  updateUserProfile(
    account,
    {
      name: `Shop ${account.seed.username}`,
      phone: account.seed.phone,
      email: account.seed.email,
      addressStreet: "42 Market Road",
      addressCity: "Chennai",
      addressState: "TN",
      addressPostalCode: "600034",
      addressCountry: "India",
      shopProfile: shopProfilePayload(account.seed.username),
      pickupAvailable: true,
      deliveryAvailable: true,
      returnsEnabled: true,
      verificationStatus: "verified",
    },
    "shop-profile",
  );
}

function createProduct(account, category) {
  const csrfToken = fetchCsrfToken(account.session, "create-product");
  const response = http.post(
    `${BASE_URL}/api/products`,
    JSON.stringify({
      name: `Load Test Product ${uniqueSuffix()}`,
      description: "Synthetic item created for automated load testing.",
      price: "499.00",
      mrp: "599.00",
      stock: 100000,
      category,
      images: ["https://placehold.co/600x400"],
      tags: ["loadtest"],
    }),
    {
      headers: jsonHeaders(csrfToken),
      jar: account.session.jar,
      tags: { name: "POST /api/products" },
    },
  );

  const ok = check(response, {
    "product created": (res) => res.status === 201,
  });
  if (!ok) {
    throw new Error(`Failed to create product: ${response.status} ${response.body}`);
  }
  return response.json();
}

function createService(account) {
  const csrfToken = fetchCsrfToken(account.session, "create-service");
  const response = http.post(
    `${BASE_URL}/api/services`,
    JSON.stringify({
      name: `Load Test Service ${uniqueSuffix()}`,
      description: "Synthetic service reserved for high-traffic load tests.",
      price: "799.00",
      duration: 60,
      category: "Wellness",
      images: ["https://placehold.co/600x400"],
      addressStreet: "5 Service Plaza",
      addressCity: "Bengaluru",
      addressState: "KA",
      addressPostalCode: "560001",
      addressCountry: "India",
      bufferTime: 15,
      workingHours: serviceWorkingHours(),
      breakTime: [{ start: "13:00", end: "14:00" }],
      maxDailyBookings: 12,
      serviceLocationType: "provider_location",
    }),
    {
      headers: jsonHeaders(csrfToken),
      jar: account.session.jar,
      tags: { name: "POST /api/services" },
    },
  );

  const ok = check(response, {
    "service created": (res) => res.status === 201,
  });
  if (!ok) {
    throw new Error(`Failed to create service: ${response.status} ${response.body}`);
  }
  return response.json();
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number(value);
}

export function setup() {
  const shopAccount = registerUserWithRole("shop", createSession());
  verifyShopProfile(shopAccount);
  const product = createProduct(shopAccount, DEFAULT_CATEGORY);

  const providerAccount = registerUserWithRole("provider", createSession());
  verifyProviderProfile(providerAccount);
  const service = createService(providerAccount);

  const customerAccount = registerUserWithRole("customer", createSession());
  verifyCustomerProfile(customerAccount);

  console.log(
    `Seeded product ${product.id} in ${product.category} and service ${service.id} for load test.`,
  );

  return {
    baseUrl: BASE_URL,
    loginUser: customerAccount.credentials,
    product: {
      id: product.id,
      category: (product.category || DEFAULT_CATEGORY).toLowerCase(),
      price: toNumber(product.price),
    },
    serviceId: service.id,
  };
}

function simulateRegistrationSpike(baseUrl) {
  const session = createSession();
  const suffix = uniqueSuffix();
  const payload = {
    username: `load_customer_${suffix}`,
    password: `P@ss${suffix}`,
    role: "customer",
    name: `Customer ${suffix}`,
    phone: randomDigits(10),
    email: `customer.${suffix}@example.com`,
    language: "en",
  };
  const csrfToken = fetchCsrfToken(session, "anon-register");
  const response = http.post(
    `${baseUrl}/api/register`,
    JSON.stringify(payload),
    {
      headers: jsonHeaders(csrfToken),
      jar: session.jar,
      tags: { name: "POST /api/register", role: "load-customer" },
    },
  );
  check(response, {
    "signup accepted": (res) => res.status === 201,
  });
}

function loginCustomer(baseUrl, credentials, session) {
  const csrfToken = fetchCsrfToken(session, "customer-login");
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
    },
  );
  check(response, {
    "login successful": (res) => res.status === 200,
  });
}

function browseCatalog(baseUrl, category, serviceId, session) {
  const productResponse = http.get(
    `${baseUrl}/api/products?category=${encodeURIComponent(category)}`,
    {
      jar: session.jar,
      tags: { name: "GET /api/products" },
    },
  );
  check(productResponse, {
    "products fetched": (res) => res.status === 200,
  });

  const serviceResponse = http.get(
    `${baseUrl}/api/services/${serviceId}`,
    {
      jar: session.jar,
      tags: { name: "GET /api/services/:id" },
    },
  );
  check(serviceResponse, {
    "service fetched": (res) => res.status === 200,
  });

  const ordersResponse = http.get(
    `${baseUrl}/api/orders/customer?status=all`,
    {
      jar: session.jar,
      tags: { name: "GET /api/orders/customer" },
    },
  );
  check(ordersResponse, {
    "customer orders fetched": (res) => res.status === 200,
  });
}

function submitOrder(baseUrl, product, session) {
  const csrfToken = fetchCsrfToken(session, "create-order");
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
    },
  );
  check(response, {
    "order created": (res) => res.status === 201,
  });
}

function logout(baseUrl, session) {
  const csrfToken = fetchCsrfToken(session, "logout");
  const response = http.post(`${baseUrl}/api/logout`, "{}", {
    headers: jsonHeaders(csrfToken),
    jar: session.jar,
    tags: { name: "POST /api/logout" },
  });
  check(response, {
    "logout ok": (res) => res.status === 200,
  });
}

function getSessionForVu() {
  let session = vuSessions.get(__VU);
  if (!session) {
    session = createSession();
    vuSessions.set(__VU, session);
    vuAuthState.set(__VU, false);
  }
  return session;
}

export default function main(data) {
  const { baseUrl, loginUser, product, serviceId } = data;
  const customerSession = getSessionForVu();
  const isAuthenticated = vuAuthState.get(__VU) === true;

  if (ENABLE_REG_SPIKE) {
    group("Anonymous registration traffic", () => {
      simulateRegistrationSpike(baseUrl);
    });
  }

  group("Authenticated customer journey", () => {
    if (!isAuthenticated) {
      loginCustomer(baseUrl, loginUser, customerSession);
      vuAuthState.set(__VU, true);
    }
    browseCatalog(baseUrl, product.category, serviceId, customerSession);
    submitOrder(baseUrl, product, customerSession);
  });

  sleep(1);
}
