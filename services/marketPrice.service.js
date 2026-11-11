const TradingAsset = require('../models/TradingAsset');

const COINGECKO_PUBLIC_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_URL = 'https://pro-api.coingecko.com/api/v3';
const TWELVE_DATA_URL = 'https://api.twelvedata.com';

let refreshInProgress = false;

/** Common symbol → CoinGecko id fallbacks when coingecko_id is missing */
const COINGECKO_SYMBOL_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', SOL: 'solana', TRX: 'tron',
  DOT: 'polkadot', MATIC: 'matic-network', POL: 'matic-network', LTC: 'litecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', ATOM: 'cosmos', UNI: 'uniswap',
  XLM: 'stellar', BCH: 'bitcoin-cash', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum',
  OP: 'optimism', SUI: 'sui', PEPE: 'pepe', SHIB: 'shiba-inu', TON: 'the-open-network',
  DAI: 'dai', AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token', FIL: 'filecoin',
  ICP: 'internet-computer', HBAR: 'hedera-hashgraph', VET: 'vechain', ALGO: 'algorand',
  EGLD: 'elrond-erd-2', FTM: 'fantom', SAND: 'the-sandbox', MANA: 'decentraland',
  AXS: 'axie-infinity', GRT: 'the-graph', RNDR: 'render-token', INJ: 'injective-protocol',
  TAO: 'bittensor', CRO: 'crypto-com-chain', LEO: 'leo-token', OKB: 'okb',
  STX: 'blockstack', IMX: 'immutable-x', RUNA: 'thorchain', THETA: 'theta-token',
  FLOW: 'flow', KAVA: 'kava', ZEC: 'zcash', XMR: 'monero', ETC: 'ethereum-classic',
  USDE: 'ethena-usde', USYC: 'circle-usyc', CC: 'canton'
};

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeProvider(value) {
  const source = String(value || '').trim().toLowerCase();
  if (['coingecko', 'coin_gecko', 'coin-gecko', 'cg'].includes(source)) return 'coingecko';
  if (['twelvedata', 'twelve_data', 'twelve-data', 'td'].includes(source)) return 'twelvedata';
  return source;
}

function resolveProvider(asset) {
  const explicit = normalizeProvider(asset.data_source);
  if (explicit === 'coingecko' || explicit === 'twelvedata') return explicit;
  if (asset.coingecko_id) return 'coingecko';
  if (asset.twelvedata_symbol) return 'twelvedata';

  const assetClass = String(asset.asset_class || '').toLowerCase();
  if (assetClass === 'crypto') return 'coingecko';
  if (['stock', 'stocks', 'forex', 'etf', 'index', 'indices'].includes(assetClass)) return 'twelvedata';
  if (asset.external_id) {
    // heuristic: ids with dashes look like coingecko
    if (String(asset.external_id).includes('-')) return 'coingecko';
    return 'twelvedata';
  }
  return null;
}

function resolveCoinGeckoId(asset) {
  const direct = String(asset.coingecko_id || '').trim();
  if (direct) return direct;
  const external = String(asset.external_id || '').trim();
  if (external && !/^[A-Z0-9./]+$/i.test(external)) return external; // likely slug
  if (external && external.includes('-')) return external;
  const sym = String(asset.symbol || '').trim().toUpperCase();
  if (sym && COINGECKO_SYMBOL_MAP[sym]) return COINGECKO_SYMBOL_MAP[sym];
  // last resort: lowercase symbol as id (sometimes works e.g. "bitcoin" already in symbol field)
  if (external) return external.toLowerCase();
  if (sym) return sym.toLowerCase();
  return '';
}

function resolveTwelveDataSymbol(asset) {
  return String(asset.twelvedata_symbol || asset.external_id || asset.symbol || '').trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(Number(process.env.MARKET_PRICE_HTTP_TIMEOUT_MS || 20000))
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Market provider returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const providerMessage = body?.error || body?.message || body?.status?.message;
    throw new Error(providerMessage || `Market provider request failed with HTTP ${response.status}.`);
  }

  if (body?.status === 'error') {
    throw new Error(body.message || 'Market provider returned an error.');
  }

  return body;
}

async function fetchCoinGeckoPrices(assets) {
  const ids = assets.map(resolveCoinGeckoId).filter(Boolean);
  if (!ids.length) return new Map();

  const uniqueIds = [...new Set(ids)];
  // CoinGecko limits: chunk ids to avoid URL length / rate issues
  const chunkSize = 50;
  const result = new Map();
  const apiKey = String(process.env.COINGECKO_API_KEY || '').trim();
  const apiPlan = String(process.env.COINGECKO_API_PLAN || 'demo').trim().toLowerCase();
  const usePro = apiKey && apiPlan === 'pro';
  const baseUrl = usePro ? COINGECKO_PRO_URL : COINGECKO_PUBLIC_URL;
  const headers = apiKey
    ? { [usePro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key']: apiKey }
    : {};

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const query = new URLSearchParams({
      ids: chunk.join(','),
      vs_currencies: 'usd',
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true',
      include_last_updated_at: 'true'
    });

    try {
      const body = await fetchJson(`${baseUrl}/simple/price?${query.toString()}`, { headers });
      for (const id of chunk) {
        const row = body[id];
        if (!row || numberOrNull(row.usd) === null) continue;
        result.set(id, {
          price: numberOrNull(row.usd),
          price_change_pct_24h: numberOrNull(row.usd_24h_change) ?? 0,
          change_24h: numberOrNull(row.usd_24h_change) ?? 0,
          volume_24h: numberOrNull(row.usd_24h_vol) ?? 0,
          market_cap: numberOrNull(row.usd_market_cap) ?? 0,
          provider_updated_at: row.last_updated_at ? new Date(Number(row.last_updated_at) * 1000) : new Date()
        });
      }
    } catch (err) {
      // rethrow only if first chunk and nothing collected
      if (!result.size && i === 0) throw err;
      console.error('CoinGecko chunk failed:', err.message);
    }
  }

  return result;
}

async function fetchTwelveDataPrices(assets) {
  const symbols = assets.map(resolveTwelveDataSymbol).filter(Boolean);
  if (!symbols.length) return new Map();

  const uniqueSymbols = [...new Set(symbols)];
  const apiKey = String(process.env.TWELVE_DATA_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('TWELVE_DATA_API_KEY is not configured in the backend .env.');
  }

  const result = new Map();
  // Twelve Data free plan often limits batch size — fetch in small batches
  const chunkSize = 8;
  for (let i = 0; i < uniqueSymbols.length; i += chunkSize) {
    const chunk = uniqueSymbols.slice(i, i + chunkSize);
    const query = new URLSearchParams({
      symbol: chunk.join(','),
      apikey: apiKey
    });
    try {
      const body = await fetchJson(`${TWELVE_DATA_URL}/quote?${query.toString()}`);
      if (chunk.length === 1 && body && body.price !== undefined) {
        const normalized = normalizeTwelveDataQuote(body);
        if (normalized.price !== null) result.set(chunk[0], normalized);
      } else {
        for (const symbol of chunk) {
          const row = body?.[symbol];
          if (row && typeof row === 'object') {
            const normalized = normalizeTwelveDataQuote(row);
            if (normalized.price !== null) result.set(symbol, normalized);
          }
        }
      }
    } catch (err) {
      if (!result.size && i === 0) throw err;
      console.error('TwelveData chunk failed:', err.message);
    }
  }

  return result;
}

function normalizeTwelveDataQuote(row) {
  const price = numberOrNull(row.price ?? row.close ?? row.last);
  const percentChange = numberOrNull(row.percent_change ?? row.percentChange);
  const change = numberOrNull(row.change);
  return {
    price,
    price_change_pct_24h: percentChange ?? 0,
    change_24h: change ?? 0,
    high_24h: numberOrNull(row.high) ?? 0,
    low_24h: numberOrNull(row.low) ?? 0,
    volume_24h: numberOrNull(row.volume) ?? 0,
    provider_updated_at: row.datetime ? new Date(row.datetime) : new Date()
  };
}

async function applyMarketData(asset, data, provider) {
  if (!data || data.price === null) {
    throw new Error(`No live price was returned for ${asset.symbol}.`);
  }

  asset.price = data.price;
  asset.price_change_24h = data.change_24h ?? asset.price_change_24h ?? 0;
  asset.change_24h = data.change_24h ?? asset.change_24h ?? 0;
  asset.price_change_pct_24h = data.price_change_pct_24h ?? asset.price_change_pct_24h ?? 0;
  if (data.high_24h !== undefined && data.high_24h !== null) asset.high_24h = data.high_24h;
  if (data.low_24h !== undefined && data.low_24h !== null) asset.low_24h = data.low_24h;
  if (data.volume_24h !== undefined && data.volume_24h !== null) asset.volume_24h = data.volume_24h;
  if (data.market_cap !== undefined && data.market_cap !== null) asset.market_cap = data.market_cap;
  asset.data_source = provider;
  asset.price_updated_at = data.provider_updated_at || new Date();
  await asset.save();
  return asset.toObject ? asset.toObject() : asset;
}

async function refreshAsset(assetOrId) {
  const asset = typeof assetOrId === 'object' && assetOrId?._id
    ? assetOrId
    : await TradingAsset.findById(assetOrId);

  if (!asset) throw new Error('Asset not found.');

  const provider = resolveProvider(asset);
  if (!provider) {
    throw new Error(`${asset.symbol} has no configured live market provider. Set data_source to coingecko or twelvedata.`);
  }

  if (provider === 'coingecko') {
    const id = resolveCoinGeckoId(asset);
    if (!id) throw new Error(`${asset.symbol} needs a CoinGecko id (coingecko_id / external_id).`);
    const data = await fetchCoinGeckoPrices([asset]);
    const row = data.get(id);
    return applyMarketData(asset, row, provider);
  }

  const symbol = resolveTwelveDataSymbol(asset);
  if (!symbol) throw new Error(`${asset.symbol} needs a Twelve Data symbol.`);
  const data = await fetchTwelveDataPrices([asset]);
  const row = data.get(symbol);
  return applyMarketData(asset, row, provider);
}

async function refreshAllAssets(options = {}) {
  if (refreshInProgress) {
    return {
      success: false,
      skipped: true,
      updated: 0,
      failed: 0,
      total: 0,
      message: 'A market price refresh is already running.',
      results: []
    };
  }

  refreshInProgress = true;

  try {
    const query = options.activeOnly === false ? {} : { is_active: true };
    if (options.assetClass && String(options.assetClass).toLowerCase() !== 'all') {
      const c = String(options.assetClass).toLowerCase();
      if (c === 'stocks') query.asset_class = { $in: ['stock', 'stocks'] };
      else if (c === 'indices') query.asset_class = { $in: ['index', 'indices'] };
      else if (c === 'etfs') query.asset_class = { $in: ['etf', 'etfs'] };
      else query.asset_class = c;
    }
    const assets = await TradingAsset.find(query).sort({ asset_class: 1, name: 1 });
    if (!assets.length) {
      return {
        success: false,
        updated: 0,
        failed: 0,
        total: 0,
        results: [],
        message: `No assets found for category "${options.assetClass || 'all'}".`,
        refreshed_at: new Date().toISOString()
      };
    }
    const coingeckoAssets = assets.filter(asset => resolveProvider(asset) === 'coingecko');
    const twelveDataAssets = assets.filter(asset => resolveProvider(asset) === 'twelvedata');
    const unsupportedAssets = assets.filter(asset => !resolveProvider(asset));

    const results = [];
    let coingeckoMap = new Map();
    let twelveDataMap = new Map();
    let providerErrors = [];

    if (coingeckoAssets.length) {
      try {
        coingeckoMap = await fetchCoinGeckoPrices(coingeckoAssets);
      } catch (error) {
        providerErrors.push(`CoinGecko: ${error.message}`);
        results.push({ provider: 'coingecko', success: false, error: error.message });
      }
    }

    if (twelveDataAssets.length) {
      try {
        twelveDataMap = await fetchTwelveDataPrices(twelveDataAssets);
      } catch (error) {
        providerErrors.push(`TwelveData: ${error.message}`);
        results.push({ provider: 'twelvedata', success: false, error: error.message });
      }
    }

    let updated = 0;
    let failed = 0;

    for (const asset of coingeckoAssets) {
      try {
        const id = resolveCoinGeckoId(asset);
        const row = coingeckoMap.get(id);
        if (!row) throw new Error(`No live price returned for ${asset.symbol} (id: ${id || 'missing'}).`);
        await applyMarketData(asset, row, 'coingecko');
        updated += 1;
        results.push({ asset: asset.symbol, provider: 'coingecko', success: true });
      } catch (error) {
        failed += 1;
        results.push({ asset: asset.symbol, provider: 'coingecko', success: false, error: error.message });
        console.warn(`[marketPrice] coingecko fail ${asset.symbol}:`, error.message);
      }
    }

    for (const asset of twelveDataAssets) {
      try {
        const symbol = resolveTwelveDataSymbol(asset);
        const row = twelveDataMap.get(symbol);
        if (!row) throw new Error(`No live price returned for ${asset.symbol} (${symbol || 'missing symbol'}).`);
        await applyMarketData(asset, row, 'twelvedata');
        updated += 1;
        results.push({ asset: asset.symbol, provider: 'twelvedata', success: true });
      } catch (error) {
        failed += 1;
        results.push({ asset: asset.symbol, provider: 'twelvedata', success: false, error: error.message });
        console.warn(`[marketPrice] twelvedata fail ${asset.symbol}:`, error.message);
      }
    }

    for (const asset of unsupportedAssets) {
      failed += 1;
      results.push({
        asset: asset.symbol,
        provider: null,
        success: false,
        error: 'No live market provider is configured for this asset.'
      });
    }

    const failedAssets = results
      .filter(r => r.asset && r.success === false)
      .map(r => r.asset);
    const updatedAssets = results
      .filter(r => r.asset && r.success === true)
      .map(r => r.asset);

    // Also collect successes we only counted
    let message;
    if (updated > 0 && failed === 0) {
      message = `Asset prices updated successfully (${updated} assets).`;
    } else if (updated > 0) {
      message = `Updated ${updated} of ${assets.length} assets. ${failed} failed` +
        (failedAssets.length ? `: ${failedAssets.join(', ')}` : '') + '.';
    } else if (providerErrors.length) {
      message = `Price refresh failed: ${providerErrors.join(' | ')}`;
    } else {
      message = 'No asset prices could be updated. Check data_source / coingecko_id / twelvedata_symbol.' +
        (failedAssets.length ? ` Failed: ${failedAssets.join(', ')}.` : '');
    }

    if (failedAssets.length) {
      console.warn('[marketPrice] Failed assets:', failedAssets);
      results.filter(r => r.asset && !r.success).forEach(r => {
        console.warn(`  - ${r.asset} (${r.provider || 'none'}): ${r.error}`);
      });
    }
    if (updated > 0) {
      console.log(`[marketPrice] Updated ${updated} assets in category "${options.assetClass || 'all'}"`);
    }

    return {
      success: updated > 0,
      updated,
      failed,
      total: assets.length,
      failedAssets,
      results,
      message,
      refreshed_at: new Date().toISOString()
    };
  } finally {
    refreshInProgress = false;
  }
}

function startMarketPriceRefresh() {
  const intervalMs = Math.max(
    20000,
    Number(process.env.MARKET_PRICE_REFRESH_INTERVAL_MS || 60000)
  );
  const run = () => {
    refreshAllAssets().catch(error => {
      console.error('Market price refresh failed:', error.message);
    });
  };
  setTimeout(run, 5000);
  setInterval(run, intervalMs);
}

module.exports = {
  refreshAsset,
  refreshAllAssets,
  startMarketPriceRefresh,
  resolveProvider
};
