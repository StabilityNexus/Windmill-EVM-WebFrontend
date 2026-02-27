"use client";

import { useEffect, useState } from "react";
import { EventLog, ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS, CURRENT_NETWORK, NETWORKS } from "./lib/contract";

type EthereumLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};

type Order = {
  id: bigint;
  creator: string;
  isBuy: boolean;
  amount: bigint;
  startPrice: bigint;
  priceSlope: bigint;
  startTime: bigint;
  stopPrice: bigint;
  expiryTime: bigint;
  currentPrice: bigint;
};

type Trade = {
  orderId: bigint;
  amount: bigint;
  price: bigint;
  txHash: string;
};

export default function Home() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signerAddress, setSignerAddress] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isBuy, setIsBuy] = useState(true);

  const [amount, setAmount] = useState("10");
  const [startPrice, setStartPrice] = useState("0.01");
  const [priceSlope, setPriceSlope] = useState("-0.0001");
  const [stopPrice, setStopPrice] = useState("0.005");
  const [expiryMinutes, setExpiryMinutes] = useState("120");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");

  const networkCfg = NETWORKS[CURRENT_NETWORK];
  const connected = signerAddress.length > 0;

  async function getContract(write: boolean) {
    if (!provider || !connected || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    if (write) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setOrders((prev) => {
        const now = BigInt(Math.floor(Date.now() / 1000));
        return prev.map((o) => {
          let current = o.startPrice + o.priceSlope * (now - o.startTime);
          if (current < 0n) current = 0n;
          if (o.expiryTime > 0n && now >= o.expiryTime) current = 0n;
          if (o.stopPrice > 0n) {
            if (o.isBuy && current <= o.stopPrice) current = 0n;
            if (!o.isBuy && current >= o.stopPrice) current = 0n;
          }
          return { ...o, currentPrice: current };
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function connectWallet() {
    const eth = (window as unknown as { ethereum?: EthereumLike }).ethereum;
    if (!eth) {
      setMessage("MetaMask not detected.");
      return;
    }

    try {
      setBusy(true);
      try {
        await eth.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }]
        });
      } catch {
        // wallet may not support permissions API
      }

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        setMessage("No account selected.");
        return;
      }

      const browserProvider = new ethers.BrowserProvider(eth as never);
      const network = await browserProvider.getNetwork();
      if (Number(network.chainId) !== parseInt(networkCfg.chainId, 16)) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: networkCfg.chainId }]
          });
        } catch {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [networkCfg]
          });
        }
      }

      const signer = await browserProvider.getSigner();
      const addr = await signer.getAddress();
      setProvider(browserProvider);
      setSignerAddress(addr);
      setMessage("");

      await refreshAll(browserProvider, addr);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disconnectWallet() {
    setProvider(null);
    setSignerAddress("");
    setOrders([]);
    setTrades([]);

    const eth = (window as unknown as { ethereum?: EthereumLike }).ethereum;
    if (eth) {
      try {
        await eth.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      } catch {
        // optional API
      }
    }
  }

  async function refreshAll(p = provider, addr = signerAddress) {
    if (!p || !addr || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
    const ids = (await c.getActiveOrderIds()) as bigint[];
    const loaded: Order[] = [];

    for (const id of ids) {
      const [order, currentPrice] = (await c.getOrderWithPrice(id)) as [
        {
          creator: string;
          isBuy: boolean;
          amount: bigint;
          startPrice: bigint;
          priceSlope: bigint;
          startTime: bigint;
          stopPrice: bigint;
          expiryTime: bigint;
          escrowedEth: bigint;
          active: boolean;
        },
        bigint
      ];

      loaded.push({
        id,
        creator: order.creator,
        isBuy: order.isBuy,
        amount: order.amount,
        startPrice: order.startPrice,
        priceSlope: order.priceSlope,
        startTime: order.startTime,
        stopPrice: order.stopPrice,
        expiryTime: order.expiryTime,
        currentPrice
      });
    }

    const ev = await c.queryFilter(c.filters.OrderExecuted(), 0, "latest");
    const latest = ev
      .slice(-10)
      .reverse()
      .map((e) => {
        const evLog = e as EventLog;
        return {
          orderId: evLog.args.orderId as bigint,
          amount: evLog.args.amount as bigint,
          price: evLog.args.price as bigint,
          txHash: evLog.transactionHash
        };
      });

    setOrders(loaded);
    setTrades(latest);
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    const writeContract = await getContract(true);
    if (!writeContract) {
      setMessage("Connect wallet first.");
      return;
    }

    try {
      setBusy(true);
      const amountBN = BigInt(amount);
      const startPriceWei = ethers.parseEther(startPrice);
      const slopePerHour = ethers.parseEther(priceSlope || "0");
      const slopePerSecond = slopePerHour / 3600n;
      const stopPriceWei = stopPrice ? ethers.parseEther(stopPrice) : 0n;
      const expiry = expiryMinutes
        ? BigInt(Math.floor(Date.now() / 1000)) + BigInt(expiryMinutes) * 60n
        : 0n;

      const value = isBuy ? amountBN * startPriceWei : 0n;
      const tx = await writeContract.createOrder(isBuy, amountBN, startPriceWei, slopePerSecond, stopPriceWei, expiry, { value });
      await tx.wait();
      await refreshAll();
      setMessage("Order created.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function executeOrder(order: Order) {
    const writeContract = await getContract(true);
    if (!writeContract) return;
    const input = prompt(`Execute amount (max ${order.amount.toString()}):`, order.amount.toString());
    if (!input) return;

    try {
      const qty = BigInt(input);
      if (qty <= 0n || qty > order.amount) {
        setMessage("Invalid execute amount.");
        return;
      }
      setBusy(true);
      const price = (await writeContract.currentPrice(order.id)) as bigint;
      if (price === 0n) {
        setMessage("Order is not executable now.");
        return;
      }
      const value = order.isBuy ? 0n : qty * price;
      const tx = await writeContract.executeOrder(order.id, qty, { value });
      await tx.wait();
      await refreshAll();
      setMessage("Order executed.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(orderId: bigint) {
    const writeContract = await getContract(true);
    if (!writeContract) return;
    try {
      setBusy(true);
      const tx = await writeContract.cancelOrder(orderId);
      await tx.wait();
      await refreshAll();
      setMessage("Order cancelled.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function expireOrder(orderId: bigint) {
    const writeContract = await getContract(true);
    if (!writeContract) return;
    try {
      setBusy(true);
      const tx = await writeContract.expireOrder(orderId);
      await tx.wait();
      await refreshAll();
      setMessage("Order expired and cleaned up.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wm-wrap">
      <header className="wm-header">
        <div className="wm-brand">
          <span className="wm-mark">W</span>
          <h1>Windmill Auction Order Book</h1>
          <span className="wm-pill">MVP</span>
        </div>
        <div className="wm-wallet">
          <span className="wm-network">{networkCfg.chainName}</span>
          {connected ? (
            <>
              <code>{shortenAddress(signerAddress)}</code>
              <button onClick={disconnectWallet}>Disconnect</button>
            </>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}
        </div>
      </header>

      <section className="wm-banner">
        <strong>Lazy deterministic pricing:</strong> prices are computed on demand from order params + time.
      </section>

      {message ? <section className="wm-message">{message}</section> : null}

      <div className="wm-grid">
        <section className="wm-card">
          <h2>Create Order</h2>
          <form onSubmit={createOrder} className="wm-form">
            <div className="wm-toggle">
              <button type="button" className={isBuy ? "active" : ""} onClick={() => setIsBuy(true)}>Buy</button>
              <button type="button" className={!isBuy ? "active" : ""} onClick={() => setIsBuy(false)}>Sell</button>
            </div>

            <label>
              Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              Start Price (ETH)
              <input value={startPrice} onChange={(e) => setStartPrice(e.target.value)} required />
            </label>
            <label>
              Slope (ETH/hr)
              <input value={priceSlope} onChange={(e) => setPriceSlope(e.target.value)} required />
            </label>
            <label>
              Stop Price (optional)
              <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
            </label>
            <label>
              Expiry Minutes (optional)
              <input value={expiryMinutes} onChange={(e) => setExpiryMinutes(e.target.value)} />
            </label>

            <button disabled={busy || !connected || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"}>
              Create
            </button>
          </form>
        </section>

        <section className="wm-card">
          <div className="wm-card-head">
            <h2>Active Orders</h2>
            <button onClick={() => refreshAll()} disabled={!connected || busy}>Refresh</button>
          </div>

          <div className="wm-orders">
            {orders.length === 0 ? <p className="wm-muted">No active orders.</p> : null}
            {orders.map((o) => {
              const isCreator = o.creator.toLowerCase() === signerAddress.toLowerCase();
              const executable = o.currentPrice > 0n && !isCreator;
              return (
                <article key={o.id.toString()} className={`wm-order ${o.isBuy ? "buy" : "sell"}`}>
                  <div className="wm-order-head">
                    <span>Order #{o.id.toString()}</span>
                    <span>{o.isBuy ? "BUY" : "SELL"}</span>
                  </div>
                  <div className="wm-order-grid">
                    <div>Amount: {o.amount.toString()}</div>
                    <div>Current: {ethers.formatEther(o.currentPrice)} ETH</div>
                    <div>Start: {ethers.formatEther(o.startPrice)} ETH</div>
                    <div>Slope/hr: {(Number(ethers.formatEther(o.priceSlope * 3600n))).toFixed(6)}</div>
                  </div>
                  <div className="wm-order-meta">
                    Maker: {shortenAddress(o.creator)}
                  </div>
                  <div className="wm-actions">
                    {isCreator ? (
                      <button onClick={() => cancelOrder(o.id)} disabled={busy}>Cancel</button>
                    ) : null}
                    <button onClick={() => expireOrder(o.id)} disabled={busy}>Expire</button>
                    <button onClick={() => executeOrder(o)} disabled={!executable || busy}>Execute</button>
                  </div>
                </article>
              );
            })}
          </div>

          <h3>Recent Executions</h3>
          <div className="wm-trades">
            {trades.length === 0 ? <p className="wm-muted">No executions yet.</p> : null}
            {trades.map((t) => (
              <div key={t.txHash} className="wm-trade">
                <span>Order #{t.orderId.toString()}</span>
                <span>{t.amount.toString()} @ {ethers.formatEther(t.price)} ETH</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="wm-footer">
        Contract: <code>{CONTRACT_ADDRESS}</code>
      </footer>
    </main>
  );
}

function shortenAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(err: unknown) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const maybe = err as { reason?: string; message?: string; shortMessage?: string };
    return maybe.reason ?? maybe.shortMessage ?? maybe.message ?? "Transaction failed";
  }
  return "Transaction failed";
}






