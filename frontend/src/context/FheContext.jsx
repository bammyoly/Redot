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

/** Try multiple SDK entry points (bundle → CDN ESM → UMD) */
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

        await _sdk.initSDK();

        if (typeof window === 'undefined') {
          setError('Must run in browser context.');
          setReady(false);
          return;
        }

        if (!window.ethereum) {
          setError('No wallet detected. Install MetaMask or a Web3 wallet.');
          setReady(false);
          return;
        }

        // Check if there is at least one connected account
        let accounts = [];
        try {
          accounts = await window.ethereum.request({
            method: 'eth_accounts',
          });
        } catch (e) {
          console.warn('[FHE] eth_accounts failed', e);
        }

        if (!accounts || accounts.length === 0) {
          // Wallet present but not connected yet → just wait
          setError('Connect your wallet to enable encrypted bidding.');
          setReady(false);
          return;
        }

        // Check chain
        const chainIdHex = await window.ethereum.request({
          method: 'eth_chainId',
        });
        const chainId = parseInt(chainIdHex, 16);

        if (chainId !== _sdk.SepoliaConfig.chainId) {
          setError(
            `Wrong network. Please switch your wallet to Sepolia (chainId ${_sdk.SepoliaConfig.chainId}).`
          );
          setReady(false);
          return;
        }

        const cfg = {
          ..._sdk.SepoliaConfig,
          network: window.ethereum,
          relayerUrl: 'https://relayer.testnet.zama.org',
        };

        console.log('[FHE] cfg used:', cfg);

        const inst = await _sdk.createInstance(cfg);

        if (!inst?.createEncryptedInput) {
          throw new Error('Relayer instance invalid.');
        }

        if (cancelled) return;
        setInstance(inst);
        setReady(true);
        setError('');
        console.log('[FHE] Relayer SDK ready on Sepolia (.org relayer)');
      } catch (e) {
        if (!cancelled) {
          console.error('[FHE init error]', e);
          // Simplify the scary ethers error for the UI
          const msg = e?.message || String(e);
          if (msg.includes('CALL_EXCEPTION')) {
            setError(
              'FHE init failed due to an on-chain call reverting. Check that your wallet is on Sepolia.'
            );
          } else {
            setError(msg);
          }
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

        input.add64(BigInt(valueUint64));

        const enc = await input.encrypt();

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
        const msg = e?.message || String(e);

        if (
          msg.includes('Failed to fetch') ||
          msg.includes('ERR_INTERNET_DISCONNECTED') ||
          msg.includes('NetworkError')
        ) {
          throw new Error(
            'Cannot reach Zama relayer. Check your internet/VPN/firewall and try again.'
          );
        }

        if (msg.includes("Relayer didn't response correctly")) {
          throw new Error(
            'Zama relayer rejected the input-proof (HTTP 400). This usually means the contract is not accepted/enabled on the relayer side.'
          );
        }

        throw e;
      }
    };

    const encryptBid = async (contractAddress, userAddress, bidWei) => {
      const { handle, proof } = await encryptEuint64ForContract(
        contractAddress,
        userAddress,
        bidWei
      );

      return {
        encryptedAmount: handle,
        inputProof: proof,
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
