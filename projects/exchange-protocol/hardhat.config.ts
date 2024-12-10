import type { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";
import '@nomiclabs/hardhat-etherscan'
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-truffle5";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "dotenv/config";

const bscTestnet: NetworkUserConfig = {
  url: "https://saturn-rpc.swanchain.io/",
  chainId: 2024,
  accounts: [process.env.KEY_TESTNET!],
};

const bscMainnet: NetworkUserConfig = {
  url: "https://saturn-rpc.swanchain.io/",
  chainId: 2024,
  // apiURL:"",
  accounts: [process.env.KEY_MAINNET!],
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    testnet: bscTestnet,
    // mainnet: bscMainnet,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY!,
    customChains: [
      {
        network: "testnet",
        chainId: 2024,
        urls: {
          apiURL: "https://saturn-explorer.swanchain.io/api",
          browserURL: "https://saturn-explorer.swanchain.io"
        }
      }
    ]
  },
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
        },
      },
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 99999,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  abiExporter: {
    path: "./data/abi",
    clear: true,
    flat: false,
  },
};

export default config;
