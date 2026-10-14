import axios from 'axios';

const client = axios.create({
	baseURL: import.meta.env.VITE_API_URL || '/api',
	headers: {
		'Content-Type': 'application/json'
	},
	timeout: 30000
});

client.interceptors.request.use((config) => {
	const token = localStorage.getItem('portfolio_token');
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	console.log('[API] request start', {
		method: config.method?.toUpperCase(),
		url: config.url,
		params: config.params,
		hasToken: Boolean(token)
	});
	return config;
});

client.interceptors.response.use(
	(response) => {
		console.log('[API] request success', {
			url: response.config?.url,
			status: response.status,
			itemCount: Array.isArray(response.data) ? response.data.length : 'n/a'
		});
		return response;
	},
	(error) => {
		if (error.response?.status === 401) {
			localStorage.removeItem('portfolio_token');
			localStorage.removeItem('portfolio_user');
			if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
				window.location.assign('/login');
			}
		}
		const message = error.response?.data?.message
			|| error.response?.data?.error
			|| error.response?.data
			|| error.message;
		console.error('API request failed', {
			code: error.code,
			message: error.message,
			status: error.response?.status,
			url: error.config?.url,
			params: error.config?.params,
			response: error.response?.data
		});
		return Promise.reject(new Error(typeof message === 'string' ? message : 'Request failed'));
	}
);

export const api = {
	auth: {
		register: async (payload) => (await client.post('/auth/register', payload)).data,
		login: async (payload) => (await client.post('/auth/login', payload)).data
	},
	portfolios: {
		list: async () => (await client.get('/portfolios')).data,
		get: async (portfolioId) => (await client.get(`/portfolios/${portfolioId}`)).data,
		create: async (payload) => (await client.post('/portfolios', payload)).data,
		update: async (portfolioId, payload) => (await client.put(`/portfolios/${portfolioId}`, payload)).data,
		close: async (portfolioId) => (await client.post(`/portfolios/${portfolioId}/close`)).data,
		remove: async (portfolioId) => client.delete(`/portfolios/${portfolioId}`)
	},
	themes: {
		list: async () => (await client.get('/themes')).data,
		get: async (portfolioId) => (await client.get(`/portfolios/${portfolioId}/theme`)).data,
		attach: async (portfolioId, theme) => (await client.put(`/portfolios/${portfolioId}/theme`, { theme })).data,
		updateEquityAllocations: async (theme, allocations) => (await client.put(`/themes/${theme}/equity-allocations`, { allocations })).data,
		update: async (theme, payload) => (await client.put(`/themes/${theme}`, payload)).data,
		updateDefinition: async (theme, payload) => (await client.put(`/themes/${theme}/definition`, payload)).data,
		deleteDefinition: async (theme) => client.delete(`/themes/${theme}`),
		remove: async (portfolioId) => client.delete(`/portfolios/${portfolioId}/theme`)
	},
	assetClasses: {
		list: async () => (await client.get('/asset-classes')).data
	},
	securities: {
		list: async ({ page = 0, pageSize = 50, exchange, isin, assetClass, sector, industry } = {}) => (await client.get('/securities', { params: { page, pageSize, exchange, isin, assetClass, sector, industry } })).data,
		filterOptions: async () => (await client.get('/securities/filter-options')).data,
		search: async (params) => (await client.get('/securities/search', { params })).data,
		match: async (query, date) => (await client.get('/securities/match', { params: { query, date } })).data
	},
	holdings: {
		list: async (portfolioId) => (await client.get(`/portfolios/${portfolioId}/holdings`)).data,
		summary: async (portfolioId) => (await client.get(`/portfolios/${portfolioId}/holdings/summary`)).data,
		eligibleSecurities: async (portfolioId, date, { page = 0, pageSize = 100 } = {}) => (await client.get(`/portfolios/${portfolioId}/holdings/eligible-securities`, { params: { date, page, pageSize } })).data,
		valuation: async (portfolioId, date) => (await client.get(`/portfolios/${portfolioId}/holdings/valuation`, { params: { date } })).data,
		valuations: async (portfolioId, dates) => (await client.post(`/portfolios/${portfolioId}/holdings/valuation/history`, { dates })).data,
		rebalance: async (portfolioId, payload) => client.post(`/portfolios/${portfolioId}/holdings/rebalance`, payload),
		add: async (portfolioId, payload) => (await client.post(`/portfolios/${portfolioId}/holdings`, payload)).data,
		update: async (portfolioId, holdingId, payload) => (await client.put(`/portfolios/${portfolioId}/holdings/${holdingId}`, payload)).data,
		remove: async (portfolioId, holdingId) => client.delete(`/portfolios/${portfolioId}/holdings/${holdingId}`),
		save: async (portfolioId) => (await client.post(`/portfolios/${portfolioId}/holdings/save`)).data
	},
	benchmarks: {
		indexes: async () => (await client.get('/benchmarks')).data,
		prices: async (index, from, to) => (await client.get(`/benchmarks/${index}/prices`, { params: { from, to } })).data
	}
};
