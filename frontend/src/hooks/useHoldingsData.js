import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { localDateString } from '../lib/utils';

/** Everything the Holdings page needs, plus the add / update / remove / save actions. */
export function useHoldingsData(portfolioId) {
  const [state, setState] = useState({ portfolio: null, theme: null, holdings: [], eligible: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [error, setError] = useState('');
  const eligibleLoadLockRef = useRef(false);
  const searchRequestRef = useRef(0);

  const fetchAll = useCallback(async () => {
    const portfolio = await api.portfolios.get(portfolioId);
    const [holdings, attachedTheme] = await Promise.all([
      api.holdings.list(portfolioId),
      api.themes.get(portfolioId).catch(() => null)
    ]);

    setState({
      portfolio,
      holdings,
      eligible: [],
      theme: attachedTheme || null
    });
  }, [portfolioId]);

  const loadEligibleSecurities = useCallback(async () => {
    if (eligibleLoadLockRef.current || state.eligible.length > 0) {
      console.log('[Holdings] eligible fetch skipped because already loaded or in-flight', {
        hasEligible: state.eligible.length > 0,
        inFlight: eligibleLoadLockRef.current,
        eligibleLoading
      });
      return state.eligible;
    }

    eligibleLoadLockRef.current = true;
    setEligibleLoading(true);
    setError('');

    console.log('[Holdings] starting eligible-securities fetch', { portfolioId, hasPortfolio: Boolean(state.portfolio) });

    try {
      const portfolio = state.portfolio || await api.portfolios.get(portfolioId);
      const priceDate = portfolio.holdingsSaved ? localDateString() : portfolio.purchaseDate || localDateString();
      const eligible = await api.holdings.eligibleSecurities(portfolioId, priceDate);
      const filteredEligible = eligible.filter((security) => security.assetClass !== 'CASH');

      console.log('[Holdings] eligible-securities fetch resolved', {
        portfolioId,
        total: eligible.length,
        filtered: filteredEligible.length,
        priceDate
      });

      setState((current) => ({
        ...current,
        portfolio: current.portfolio || portfolio,
        eligible: filteredEligible
      }));

      return filteredEligible;
    } catch (e) {
      console.error('[Holdings] eligible-securities fetch failed', e);
      setError(e.message || 'Unable to load eligible securities');
      throw e;
    } finally {
      eligibleLoadLockRef.current = false;
      setEligibleLoading(false);
    }
  }, [eligibleLoading, portfolioId, state.eligible, state.portfolio]);

  const searchEligibleSecurities = useCallback(async (query) => {
    const trimmed = query?.trim() || '';
    const requestId = ++searchRequestRef.current;

    if (!trimmed) {
      setState((current) => ({ ...current, eligible: [] }));
      return [];
    }

    eligibleLoadLockRef.current = true;
    setEligibleLoading(true);
    setError('');

    try {
      const matches = await api.securities.match(trimmed);
      if (requestId !== searchRequestRef.current) {
        return [];
      }

      const normalized = (matches || []).filter((security) => security.assetClass !== 'CASH');

      setState((current) => ({
        ...current,
        eligible: normalized
      }));

      return normalized;
    } catch (e) {
      console.error('[Holdings] security match search failed', e);
      if (requestId !== searchRequestRef.current) {
        return [];
      }
      setError(e.message || 'Unable to search securities');
      return [];
    } finally {
      if (requestId === searchRequestRef.current) {
        eligibleLoadLockRef.current = false;
        setEligibleLoading(false);
      }
    }
  }, [portfolioId]);

  useEffect(() => {
    setLoading(true);
    fetchAll()
      .catch((e) => setError(e.message || 'Unable to load holdings'))
      .finally(() => setLoading(false));
  }, [fetchAll]);

  // run a change, then reload so every number on the page agrees with the server
  const run = async (change, failureMessage) => {
    try {
      setBusy(true);
      setError('');
      await change();
      await fetchAll();
      return true;
    } catch (e) {
      setError(e.message || failureMessage);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    ...state,
    loading,
    busy,
    eligibleLoading,
    error,
    setError,
    searchEligibleSecurities,
    addHolding: (securityId, shares) => run(() => api.holdings.add(portfolioId, { securityId, shares }), 'Unable to add holding'),
    updateShares: (holdingId, shares) => run(() => api.holdings.update(portfolioId, holdingId, { shares }), 'Unable to update holding'),
    removeHolding: (holdingId) => run(() => api.holdings.remove(portfolioId, holdingId), 'Unable to remove holding'),
    loadEligibleSecurities,
    saveHoldings: async () => {
      try {
        setBusy(true);
        setError('');
        await api.holdings.save(portfolioId);
        return true;
      } catch (e) {
        setError(e.message || 'Unable to save holdings');
        return false;
      } finally {
        setBusy(false);
      }
    }
  };
}
