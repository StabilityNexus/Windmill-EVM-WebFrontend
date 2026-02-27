export const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "bool", "name": "isBuy", "type": "bool" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "startPrice", "type": "uint256" },
      { "internalType": "int256", "name": "priceSlope", "type": "int256" },
      { "internalType": "uint256", "name": "stopPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "expiryTime", "type": "uint256" }
    ],
    "name": "createOrder",
    "outputs": [{ "internalType": "uint256", "name": "orderId", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "orderId", "type": "uint256" }],
    "name": "currentPrice",
    "outputs": [{ "internalType": "uint256", "name": "price", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "orderId", "type": "uint256" }],
    "name": "getOrderWithPrice",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "creator", "type": "address" },
          { "internalType": "bool", "name": "isBuy", "type": "bool" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint256", "name": "startPrice", "type": "uint256" },
          { "internalType": "int256", "name": "priceSlope", "type": "int256" },
          { "internalType": "uint256", "name": "startTime", "type": "uint256" },
          { "internalType": "uint256", "name": "stopPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "expiryTime", "type": "uint256" },
          { "internalType": "uint256", "name": "escrowedEth", "type": "uint256" },
          { "internalType": "bool", "name": "active", "type": "bool" }
        ],
        "internalType": "struct AuctionOrderBookPrototype.Order",
        "name": "order",
        "type": "tuple"
      },
      { "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveOrderIds",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "orderId", "type": "uint256" }],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "orderId", "type": "uint256" }],
    "name": "expireOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "orderId", "type": "uint256" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "executeOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "orderId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "executor", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "remainingAmount", "type": "uint256" }
    ],
    "name": "OrderExecuted",
    "type": "event"
  }
] as const;

export const NETWORKS = {
  localhost: {
    chainId: "0x7a69",
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
  },
  sepolia: {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 }
  }
} as const;

export const CURRENT_NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "localhost") as keyof typeof NETWORKS;
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";
