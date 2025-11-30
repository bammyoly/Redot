'use client';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Polyfill some globals the SDK expects
if (typeof window !== 'undefined' && !window.global) {
  window.global = window;
}

const FheCtx = createContext({
  ready: false,
  error: 'Not initialized',
  encryptBid: async () => {
    throw new Error('FHE not ready');
  },
});

export const useFhe = () => useContext(FheCtx);

/** --- Utilities --- */
const toHex = (v) => {
  if (typeof v === 'string') return v.startsWith('0x') ? v : `0x${v}`;
  if (v instanceof Uint8Array)
    return `0x${[...v].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  if (Array.isArray(v)) return toHex(Uint8Array.from(v));
  if (v && v.type === 'Buffer' && Array.isArray(v.data))
    return toHex(Uint8Array.from(v.data));
  throw new Error('Unexpected bytes-like value from FHE SDK');
};

async function loadRelayerSDK() {
  const normalize = (mod) => {
    const m =
      mod && typeof mod === 'object' && 'default' in mod && mod.default
        ? mod.default
        : mod;
    const createInstance = m?.createInstance;
    const SepoliaConfig = m?.SepoliaConfig;
    const initSDK =
      typeof m?.initSDK === 'function' ? m.initSDK : async () => {};
    if (!createInstance || !SepoliaConfig)
      throw new Error('Relayer SDK missing createInstance/SepoliaConfig');
    return { initSDK, createInstance, SepoliaConfig };
  };

  // 1) NPM bundle build (preferred)
  try {
    const mod = await import(
      /* @vite-ignore */ '@zama-fhe/relayer-sdk/bundle'
    );
    console.log('[FHE] Loaded relayer-sdk bundle');
    return normalize(mod);
  } catch (e) {
    console.warn('[FHE] bundle import failed, falling back to CDN/UMD', e);
  }

  // 2) CDN ESM
  try {
    const url =
      'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.js';
    const mod = await import(/* @vite-ignore */ url);
    console.log('[FHE] Loaded relayer-sdk from CDN ESM');
    return normalize(mod);
  } catch (e) {
    console.warn('[FHE] CDN ESM import failed, falling back to UMD', e);
  }

  // 3) UMD fallback
  await new Promise((resolve, reject) => {
    if (window.fhevm) return resolve();
    const s = document.createElement('script');
    s.src =
      'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs';
    s.async = true;
    s.onload = () =>
      window.fhevm ? resolve() : reject(new Error('UMD load failed'));
    s.onerror = () => reject(new Error('UMD network error'));
    document.head.appendChild(s);
  });

  const m = window.fhevm;
  if (!m) throw new Error('Relayer SDK UMD not found on window');

  console.log('[FHE] Loaded relayer-sdk from UMD');
  return {
    initSDK: typeof m.initSDK === 'function' ? m.initSDK : async () => {},
    createInstance: m.createInstance,
    SepoliaConfig: m.SepoliaConfig,
  };
}

export function FheProvider({ children }) {
  const [sdk, setSdk] = useState(null);
  const [instance, setInstance] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('Not initialized');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const _sdk = await loadRelayerSDK();
        setSdk(_sdk);

        // Load WASM (no-op for some builds)
        await _sdk.initSDK();

        if (typeof window === 'undefined')
          throw new Error('Must run in browser context.');
        if (!window.ethereum)
          throw new Error('No wallet detected (window.ethereum missing).');

        // Override relayer URL to .org domain
        const cfg = {
          ..._sdk.SepoliaConfig,
          network: window.ethereum,
          relayerUrl: 'https://relayer.testnet.zama.org',
        };

        console.log('[FHE] Creating instance with config:', cfg);

        const inst = await _sdk.createInstance(cfg);

        if (!inst?.createEncryptedInput)
          throw new Error('Relayer instance invalid.');

        if (cancelled) return;
        setInstance(inst);
        setReady(true);
        setError('');
        console.log('[FHE] Relayer SDK ready on Sepolia (.org relayer)');
      } catch (e) {
        if (!cancelled) {
          console.error('[FHE init error]', e);
          setError(e?.message || String(e));
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const api = useMemo(() => {
    if (!sdk || !instance) {
      return {
        ready: false,
        error,
        encryptBid: async () => {
          throw new Error(error || 'FHE not ready');
        },
      };
    }

    // Low-level helper used by encryptBid
    const encryptEuint64ForContract = async (
      contractAddress,
      userAddress,
      valueUint64
    ) => {
      if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress))
        throw new Error('Bad contract address');
      if (!/^0x[0-9a-fA-F]{40}$/.test(userAddress))
        throw new Error('Bad user address');

      console.log('[FHE] encryptEuint64ForContract called with:', {
        contractAddress,
        userAddress,
        valueUint64: valueUint64.toString(),
      });

      try {
        const input = instance.createEncryptedInput(
          contractAddress,
          userAddress
        );

        // For euint64 / externalEuint64
        input.add64(BigInt(valueUint64));

        const enc = await input.encrypt(); // <--- relayer call here

        const handle = toHex(enc?.handles?.[0] ?? '0x');
        const proof = toHex(enc?.inputProof ?? '0x');

        if (handle.length !== 66)
          throw new Error(
            `Bad FHE handle length (${handle.length}). Expected 66.`
          );
        if (!/^0x[0-9a-fA-F]+$/.test(proof))
          throw new Error('FHE proof is not valid hex.');

        console.log('[FHE] Encryption success:', {
          handle,
          proofLength: proof.length,
        });

        return { handle, proof };
      } catch (e) {
        console.error('[FHE encryptEuint64ForContract error]', e);
        throw e;
      }
    };

    // High-level helper for your auction dapp
    const encryptBid = async (contractAddress, userAddress, bidWei) => {
      const { handle, proof } = await encryptEuint64ForContract(
        contractAddress,
        userAddress,
        bidWei
      );

      return {
        encryptedAmount: handle, // externalEuint64 for Solidity
        inputProof: proof, // bytes for FHE.fromExternal
      };
    };

    return {
      ready: true,
      error: '',
      encryptBid,
    };
  }, [sdk, instance, error]);

  return <FheCtx.Provider value={api}>{children}</FheCtx.Provider>;
}
