import { ethers, network } from "hardhat";
import config from "../config";

const currentNetwork = network.name;

const main = async (withVRFOnTestnet: boolean = true) => {
  const MieSwapLottery = await ethers.getContractFactory("MieSwapLottery");

  if (currentNetwork == "testnet") {
    let randomNumberGenerator;

    if (withVRFOnTestnet) {
      console.log("RandomNumberGenerator with VRF is deployed..");
      const RandomNumberGenerator = await ethers.getContractFactory("RandomNumberGenerator");

      randomNumberGenerator = await RandomNumberGenerator.deploy(
        config.VRFCoordinator[currentNetwork],
        config.LinkToken[currentNetwork]
      );
      await randomNumberGenerator.deployed();
      console.log("RandomNumberGenerator deployed to:", randomNumberGenerator.address);

      // Set fee
      await randomNumberGenerator.setFee(config.FeeInLink[currentNetwork]);

      // Set key hash
      await randomNumberGenerator.setKeyHash(config.KeyHash[currentNetwork]);
    } else {
      console.log("RandomNumberGenerator without VRF is deployed..");

      const RandomNumberGenerator = await ethers.getContractFactory("MockRandomNumberGenerator");
      randomNumberGenerator = await RandomNumberGenerator.deploy();
      await randomNumberGenerator.deployed();

      console.log("RandomNumberGenerator deployed to:", randomNumberGenerator.address);
    }

    const pancakeSwapLottery = await MieSwapLottery.deploy(
      config.CakeToken[currentNetwork],
      randomNumberGenerator.address
    );

    await pancakeSwapLottery.deployed();
    console.log("MieSwapLottery deployed to:", pancakeSwapLottery.address);

    // Set lottery address
    await randomNumberGenerator.setLotteryAddress(pancakeSwapLottery.address);
  } else if (currentNetwork == "mainnet") {
    const RandomNumberGenerator = await ethers.getContractFactory("RandomNumberGenerator");
    const randomNumberGenerator = await RandomNumberGenerator.deploy(
      config.VRFCoordinator[currentNetwork],
      config.LinkToken[currentNetwork]
    );

    await randomNumberGenerator.deployed();
    console.log("RandomNumberGenerator deployed to:", randomNumberGenerator.address);

    // Set fee
    await randomNumberGenerator.setFee(config.FeeInLink[currentNetwork]);

    // Set key hash
    await randomNumberGenerator.setKeyHash(config.KeyHash[currentNetwork]);

    const pancakeSwapLottery = await MieSwapLottery.deploy(
      config.CakeToken[currentNetwork],
      randomNumberGenerator.address
    );

    await pancakeSwapLottery.deployed();
    console.log("MieSwapLottery deployed to:", pancakeSwapLottery.address);

    // Set lottery address
    await randomNumberGenerator.setLotteryAddress(pancakeSwapLottery.address);

    // Set operator & treasury adresses
    await pancakeSwapLottery.setOperatorAndTreasuryAndInjectorAddresses(
      config.OperatorAddress[currentNetwork],
      config.TreasuryAddress[currentNetwork],
      config.InjectorAddress[currentNetwork]
    );
  }
};

main(true)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
