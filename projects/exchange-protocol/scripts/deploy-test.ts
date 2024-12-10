import { ethers, network, run } from "hardhat";

import { writeFileSync } from 'fs'
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";

// const devAddress = "0x1081cC43D898AaC3ca6D4AABe421ffb3AD88eA77"
// const testSFSAddress = "0xBBd707815a7F7eb6897C7686274AFabd7B579Ff6"
const main = async () => {
    // Compile contracts
    // await run("compile");
    // console.log("Compiled contracts.");

    const deployToken = async (name, symbol, _totalSupply) => {
        const TokenFactory = await ethers.getContractFactory("MockERC20");
        const totalSupply = parseEther(_totalSupply.toString());
        const token = await TokenFactory.deploy(name, symbol, totalSupply);
        await token.deployed();
        return token
    };

    // const cake = await deployToken('TEST', 'TST', 1000000000);
    const usdt = await deployToken('USD Tether', 'USDT', 1000000000);
    // const usdc = await deployToken('USD Coin', 'USDC', 1000000000);
    // const busd = await deployToken('Binance USD', 'BUSD', 1000000000);

    const contracts = {
        // cake: cake.address,
        usdt: usdt.address,
        // usdc: usdc.address,
        // busd: busd.address
    }
    console.log(contracts)

    writeFileSync(`./deployments/test-token-${network.name}.json`, JSON.stringify(contracts, null, 2))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
