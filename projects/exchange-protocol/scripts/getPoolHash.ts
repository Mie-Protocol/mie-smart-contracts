import { ethers } from 'hardhat'
// import { Contract } from 'hardhat/internal/hardhat-network/stack-traces/model'
const MiePair = require('../artifacts/contracts/MiePair.sol/MiePair.json')
const factory = require('../artifacts/contracts/MieFactory.sol/MieFactory.json')
async function main() {
    const hash = ethers.utils.keccak256(MiePair.bytecode)
    console.log(hash)
}
main()