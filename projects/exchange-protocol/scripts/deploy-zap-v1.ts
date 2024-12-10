import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Compile contracts
  await run("compile");
  console.log("Compiled contracts.");

  const networkName = network.name;

  // Sanity checks
  if (networkName === "mainnet") {
    if (!process.env.KEY_MAINNET) {
      throw new Error("Missing private key, refer to README 'Deployment' section");
    }
  } else if (networkName === "testnet") {
    if (!process.env.KEY_TESTNET) {
      throw new Error("Missing private key, refer to README 'Deployment' section");
    }
  }

  if (!config.MieRouter[networkName] || config.MieRouter[networkName] === ethers.constants.AddressZero) {
    throw new Error("Missing router address, refer to README 'Deployment' section");
  }

  if (!config.WBNB[networkName] || config.WBNB[networkName] === ethers.constants.AddressZero) {
    throw new Error("Missing WBNB address, refer to README 'Deployment' section");
  }

  console.log("Deploying to network:", networkName);

  // Deploy MieZapV1
  console.log("Deploying MieZap V1..");

  const MieZapV1 = await ethers.getContractFactory("MieZapV1");

  const pancakeZap = await MieZapV1.deploy(
    config.WBNB[networkName],
    config.MieRouter[networkName],
    config.MaxZapReverseRatio[networkName]
  );

  await pancakeZap.deployed();

  console.log("MieZap V1 deployed to:", pancakeZap.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
