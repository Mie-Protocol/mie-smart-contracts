import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Get network data from Hardhat config (see hardhat.config.ts).
  const networkName = network.name;

  // Check if the network is supported.

  if (networkName === "testnet" || networkName === "mainnet") {
    console.log(`Deploying to ${networkName} network...`);

    // Check if the addresses in the config are set.
    if (config.CakeToken[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Cake token");
    }

    if (config.MieProfile[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Mie Profile");
    }

    if (config.Chainlink.LinkToken[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Link token");
    }

    if (config.Operator[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Link token");
    }

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts...");

    // Deploy contracts.
    const MieSquad = await ethers.getContractFactory("MieSquad");
    const pancakeSquad = await MieSquad.deploy(
      config.ERC721.Name[networkName],
      config.ERC721.Symbol[networkName],
      config.ERC721.Supply.Total[networkName]
    );

    // Wait for the contract to be deployed
    await pancakeSquad.deployed();
    console.log(`MieSquad to ${pancakeSquad.address}`);

    const NFTSale = await ethers.getContractFactory("NFTSale");

    const nftSale = await NFTSale.deploy(
      pancakeSquad.address,
      config.ERC721.Supply.Reserve[networkName],
      config.PricePerTicket[networkName],
      config.CakeToken[networkName],
      config.MieProfile[networkName],
      config.Operator[networkName],
      config.Chainlink.VRFCoordinator[networkName],
      config.Chainlink.LinkToken[networkName]
    );

    // Wait for the contract to be deployed
    await nftSale.deployed();
    console.log(`NFTSale to ${nftSale.address}`);

    // Transfer ownership of MieSquad to NFTSale contract
    let tx = await pancakeSquad.transferOwnership(nftSale.address);
    await tx.wait();
    console.log(`Ownership of MieSquad transferred to ${nftSale.address}`);

    // Set fee and key hash for VRF
    tx = await nftSale.setFeeAndKeyHash(config.Chainlink.Fee[networkName], config.Chainlink.KeyHash[networkName]);

    await tx.wait();
    console.log(`Key hashes and fee set`);

    tx = await nftSale.drawRandomness();
    await tx.wait();
    console.log(`Test randomness has been called.`);
  } else {
    console.log(`Deploying to ${networkName} network is not supported...`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
