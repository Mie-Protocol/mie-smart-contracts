import { ethers, network, run } from "hardhat";

import { writeFileSync } from 'fs'


export async function verifyContract(contract: string, constructorArguments: any[] = []) {
    if (process.env.ETHERSCAN_API_KEY) {
      try {
        console.info('Verifying', contract, constructorArguments)
        const verify = await run('verify:verify', {
          address: contract,
          constructorArguments,
        })
        console.log(contract, ' verify successfully')
      } catch (error) {
        console.log(
          '....................',
          contract,
          ' error start............................',
          '\n',
          error,
          '\n',
          '....................',
          contract,
          ' error end............................'
        )
      }
    }
  }

const devAddress = "0xd7Da9C0f8Ae87D4BC8228bbFCD3b1102f5d8473a"
const main = async () => {
    // Compile contracts
    // await run("compile");
    // console.log("Compiled contracts.");
    console.log('starting ...')
    const WETH = await ethers.getContractFactory("WETH")
    // const weth = await WETH.deploy()
    // await weth.deployed()
    console.log('trying to verify weth')
    // await verifyContract(weth.address)

    const v2Factory = await ethers.getContractFactory("MieFactory")
    const factory = await v2Factory.deploy(devAddress)
    await factory.setFeeTo(devAddress)
    await factory.deployed()
    // await verifyContract(factory.address, [devAddress])

    const v2Router = await ethers.getContractFactory("MieRouter01")
    const router = await v2Router.deploy(factory.address, "0x14b5D4076A55596f5403691E9AA2faBe68e530CC")
    await router.deployed()
    // await verifyContract(router.address, [factory.address, weth.address])

    const contracts = {
        wrappedETH: "0x14b5D4076A55596f5403691E9AA2faBe68e530CC",
        factory: factory.address,
        router: router.address
    }
    console.log(contracts)

    writeFileSync(`./deployments/${network.name}1.json`, JSON.stringify(contracts, null, 2))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
