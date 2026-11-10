const envUrl = import.meta.env.VITE_API_URL;
const BASE = envUrl
  ? (envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`)
  : '/api';

function getToken() {
  return localStorage.getItem('pmr_token');
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  auth: {
    login: (name, password) => request('POST', '/auth/login', { name, password }),
  },

  // ── Rates ───────────────────────────────────────────────────────────────────
  rates: {
    getTodayRate: () => request('GET', '/rates/today'),
    getRateByDate: (date) => request('GET', `/rates/by-date?date=${date}`),
    getHistory: () => request('GET', '/rates/history'),
    setRate: (date, paper_rate) => request('POST', '/rates/daily', { date, paper_rate }),
    updateRate: (date, paper_rate) => request('PUT', `/rates/daily/${date}`, { paper_rate }),
  },

  // ── Daily Procurement Farms (Admin & Supervisors) ───────────────────────────
  dailyFarms: {
    getByDate: (date) => request('GET', `/daily-farms${date ? '?date=' + date : ''}`),
    create: (data) => request('POST', '/daily-farms', data),
    update: (id, data) => request('PUT', `/daily-farms/${id}`, data),
    delete: (id) => request('DELETE', `/daily-farms/${id}`),
  },

  // ── Daily Farm-Wise Distribution Sheets (Print/PDF) ─────────────────────────
  sheets: {
    getDaily: (date, groupId = null) => {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (groupId) params.append('group_id', groupId);
      const qs = params.toString();
      return request('GET', `/sheets/daily${qs ? '?' + qs : ''}`);
    },
  },

  // ── Accounting & Ledgers ───────────────────────────────────────────────────
  accounting: {
    getCustomerLedger: (customerId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/customers/${customerId}/ledger${qs ? '?' + qs : ''}`);
    },
    getPayments: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/payments${qs ? '?' + qs : ''}`);
    },
    createPayment: (data) => request('POST', '/payments', data),
    deletePayment: (id) => request('DELETE', `/payments/${id}`),
    createCreditNote: (data) => request('POST', '/credit-notes', data),
    deleteCreditNote: (id) => request('DELETE', `/credit-notes/${id}`),
    getGroupSummary: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/reports/group-summary${qs ? '?' + qs : ''}`);
    },
  },

  // ── Supervisor & Shared Operations ──────────────────────────────────────────
  supervisor: {
    getTodayRate: () => request('GET', '/rates/today'),
    getRateByDate: (date) => request('GET', `/rates/by-date?date=${date}`),
    getHistory: () => request('GET', '/rates/history'),
    setRate: (date, paper_rate) => request('POST', '/rates/daily', { date, paper_rate }),
    updateRate: (date, paper_rate) => request('PUT', `/rates/daily/${date}`, { paper_rate }),
    getGroups: () => request('GET', '/groups'),
    getCustomers: (groupId = null) => request('GET', `/customers${groupId ? '?group_id=' + groupId : ''}`),
    createCustomer: (data) => request('POST', '/customers', data),
    updateCustomer: (id, data) => request('PUT', `/customers/${id}`, data),
    deleteCustomer: (id) => request('DELETE', `/customers/${id}`),
    submitOrder: (data) => request('POST', '/orders', data),
    getOrders: (date, groupId = null) => {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (groupId) params.append('group_id', groupId);
      const qs = params.toString();
      return request('GET', `/orders${qs ? '?' + qs : ''}`);
    },
    updateOrder: (id, data) => request('PUT', `/orders/${id}`, data),
    deleteOrder: (id) => request('DELETE', `/orders/${id}`),
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    setRate: (date, paper_rate) => request('POST', '/rates/daily', { date, paper_rate }),
    updateRate: (date, paper_rate) => request('PUT', `/rates/daily/${date}`, { paper_rate }),
    getCustomers: (groupId = null) => request('GET', `/customers${groupId ? '?group_id=' + groupId : ''}`),
    createCustomer: (data) => request('POST', '/customers', data),
    updateCustomer: (id, data) => request('PUT', `/customers/${id}`, data),
    deleteCustomer: (id) => request('DELETE', `/customers/${id}`),
    getUsers: () => request('GET', '/admin/users'),
    getGroups: () => request('GET', '/groups'),
    updateOrder: (id, data) => request('PUT', `/orders/${id}`, data),
    deleteOrder: (id) => request('DELETE', `/orders/${id}`),
  },
};