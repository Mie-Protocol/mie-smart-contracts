import { parseUnits, parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";

import { assert } from "chai";
import { BN, expectEvent, expectRevert, time } from "@openzeppelin/test-helpers";

const IFOInitializable = artifacts.require("./IFOInitializable.sol");
const IFODeployer = artifacts.require("./IFODeployer.sol");

const MieProfile = artifacts.require("profile-nft-gamification/contracts/MieProfile.sol");
const MockBEP20 = artifacts.require("./utils/MockBEP20.sol");
const MockERC20 = artifacts.require("./utils/MockERC20.sol");
const MockBunnies = artifacts.require("./utils/MockBunnies.sol");

contract("IFO Deployer", ([alice, bob, carol, david, erin, frank, ...accounts]) => {
  // MieProfile
  const _totalInitSupply = parseEther("5000000"); // 50 CAKE
  const _numberCakeToReactivate = parseEther("5"); // 5 CAKE
  const _numberCakeToRegister = parseEther("5"); // 5 CAKE
  const _numberCakeToUpdate = parseEther("2"); // 2 CAKE

  // IFO block times
  let _startBlock;
  let _endBlock;

  // IFO Pool 0
  let offeringAmountPool0 = parseEther("50");
  let raisingAmountPool0 = parseEther("5");
  let limitPerUserInLp = parseEther("0.5");

  // IFO Pool 1
  let offeringAmountPool1 = parseEther("1000");
  let raisingAmountPool1 = parseEther("100");

  // offeringAmountPool0 + offeringAmountPool1
  let offeringTotalAmount = offeringAmountPool0.add(offeringAmountPool1);
  let raisingAmountTotal = parseEther("105");

  // Gamification parameters
  let campaignId = "12345678";
  let numberPoints = "100";
  let thresholdPoints = parseEther("0.035");

  // VARIABLES

  // Contracts
  let mockBunnies, mockCake, mockIFO, mockOC, mockLP, pancakeProfile, deployer;

  // Roles in MieProfile
  let DEFAULT_ADMIN_ROLE, NFT_ROLE, POINT_ROLE;
  // Generic result variable
  let result;

  before(async () => {
    // Deploy MockCAKE
    mockCake = await MockBEP20.new("Mock CAKE", "CAKE", _totalInitSupply);

    // Deploy MockLP
    mockLP = await MockBEP20.new("Mock LP", "LP", _totalInitSupply, {
      from: alice,
    });

    // Deploy MockOfferingCoin (100M initial supply)
    mockOC = await MockBEP20.new("Mock Offering Coin", "OC", parseEther("100000000"), {
      from: alice,
    });

    // Deploy Mock Bunnies
    mockBunnies = await MockBunnies.new({ from: alice });

    // Deploy Mie Profile
    pancakeProfile = await MieProfile.new(
      mockCake.address,
      _numberCakeToReactivate,
      _numberCakeToRegister,
      _numberCakeToUpdate,
      { from: alice }
    );

    // Assign the roles
    DEFAULT_ADMIN_ROLE = await pancakeProfile.DEFAULT_ADMIN_ROLE();
    NFT_ROLE = await pancakeProfile.NFT_ROLE();
    POINT_ROLE = await pancakeProfile.POINT_ROLE();
  });

  describe("Initial contract parameters for all contracts", async () => {
    it("MieProfile is correct", async () => {
      assert.equal(await pancakeProfile.cakeToken(), mockCake.address);
      assert.equal(String(await pancakeProfile.numberCakeToReactivate()), String(_numberCakeToReactivate));
      assert.equal(String(await pancakeProfile.numberCakeToRegister()), String(_numberCakeToRegister));
      assert.equal(String(await pancakeProfile.numberCakeToUpdate()), String(_numberCakeToUpdate));

      assert.equal(await pancakeProfile.getRoleMemberCount(DEFAULT_ADMIN_ROLE), "1");
    });

    it("Alice adds NFT and a team in the system", async () => {
      await pancakeProfile.addNftAddress(mockBunnies.address, {
        from: alice,
      });
      await pancakeProfile.addTeam("The Testers", "ipfs://hash/team1.json", {
        from: alice,
      });
    });

    it("Bob/Carol/David/Erin create a profile in the system", async () => {
      let i = 0;

      for (let thisUser of [bob, carol, david, erin]) {
        // Mints 100 CAKE
        await mockCake.mintTokens(parseEther("100"), { from: thisUser });

        // Mints 10,000 LP tokens
        await mockLP.mintTokens(parseEther("10000"), { from: thisUser });

        // Mints a NFT
        result = await mockBunnies.mint({ from: thisUser });

        // Approves the contract to receive his NFT
        await mockBunnies.approve(pancakeProfile.address, i, {
          from: thisUser,
        });

        // Approves CAKE to be spent by MieProfile
        await mockCake.approve(pancakeProfile.address, parseEther("100"), {
          from: thisUser,
        });

        // Creates the profile
        await pancakeProfile.createProfile("1", mockBunnies.address, i, {
          from: thisUser,
        });
        i++;
      }

      // 4 generic accounts too
      for (let thisUser of accounts) {
        // Mints 100 CAKE
        await mockCake.mintTokens(parseEther("100"), { from: thisUser });

        // Mints 1,000 LP tokens
        await mockLP.mintTokens(parseEther("1000"), { from: thisUser });

        // Mnts a NFT
        result = await mockBunnies.mint({ from: thisUser });

        // Approves the contract to receive his NFT
        await mockBunnies.approve(pancakeProfile.address, i, {
          from: thisUser,
        });

        // Approves CAKE to be spent by MieProfile
        await mockCake.approve(pancakeProfile.address, parseEther("100"), {
          from: thisUser,
        });

        // Creates the profile
        await pancakeProfile.createProfile("1", mockBunnies.address, i, {
          from: thisUser,
        });
        i++;
      }
    });
  });

  describe("IFO Deployer #0 - Initial set up", async () => {
    it("The IFODeployer is deployed and initialized", async () => {
      deployer = await IFODeployer.new(pancakeProfile.address, {
        from: alice,
      });
    });
  });
  /*
   * IFO 1 - OVERFLOW
   * Pool 0 : Overflow with 1.6x overflow
   * Pool 1: Overflow with 10x overflow
   */

  describe("IFO #1 - Initial set up", async () => {
    it("The IFO #1 is deployed and initialized", async () => {
      _startBlock = new BN(await time.latestBlock()).add(new BN("50"));
      _endBlock = new BN(await time.latestBlock()).add(new BN("250"));

      // Alice deploys the IFO setting herself as the contract admin
      let result = await deployer.createIFO(mockLP.address, mockOC.address, _startBlock, _endBlock, alice, {
        from: alice,
      });

      let ifoAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewIFOContract", { ifoAddress: ifoAddress });

      mockIFO = await IFOInitializable.at(ifoAddress);

      await expectRevert(
        mockIFO.updateStartAndEndBlocks("195", "180", { from: alice }),
        "Operations: New startBlock must be lower than new endBlock"
      );

      const blockNumber = await time.latestBlock();

      await expectRevert(
        mockIFO.updateStartAndEndBlocks(blockNumber.toString(), "195", { from: alice }),
        "Operations: New startBlock must be higher than current block"
      );

      result = await mockIFO.updateStartAndEndBlocks(_startBlock, _endBlock, { from: alice });

      expectEvent(result, "NewStartAndEndBlocks", { startBlock: _startBlock, endBlock: _endBlock });

      // Grants point role to the IFO contract
      await pancakeProfile.grantRole(POINT_ROLE, mockIFO.address);
    });

    it("Mock IFO is deployed without pools set", async () => {
      result = await mockIFO.viewUserAllocationPools(alice, ["0", "1"]);
      assert.equal(result[0].toString(), "0");
      assert.equal(result[1].toString(), "0");

      result = await mockIFO.viewUserInfo(alice, ["0", "1"]);
      assert.equal(result[0][0].toString(), "0");
      assert.equal(result[0][1].toString(), "0");
      assert.equal(result[1][0], false);
      assert.equal(result[1][1], false);

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("0")), "0");
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "0"); // Pool isn't set yet, nor in overflow

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(alice, [0, 1]);

      assert.equal(result[0][0].toString(), "0");
      assert.equal(result[0][1].toString(), "0");
      assert.equal(result[0][2].toString(), "0");
      assert.equal(result[1][0].toString(), "0");
      assert.equal(result[1][1].toString(), "0");
      assert.equal(result[1][2].toString(), "0");
    });

    it("Pools are set", async () => {
      assert.deepEqual(
        raisingAmountPool0.div(offeringAmountPool0),
        raisingAmountPool1.div(offeringAmountPool1),
        "MUST_BE_EQUAL_PRICES"
      );

      result = await mockIFO.setPool(
        offeringAmountPool0,
        raisingAmountPool0,
        limitPerUserInLp,
        false, // tax
        "0",
        { from: alice }
      );

      expectEvent(result, "PoolParametersSet", {
        offeringAmountPool: String(offeringAmountPool0),
        raisingAmountPool: String(raisingAmountPool0),
        pid: String(0),
      });

      assert.equal(String(await mockIFO.totalTokensOffered()), String(offeringAmountPool0));

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("0")), "0");

      result = await mockIFO.setPool(
        offeringAmountPool1,
        raisingAmountPool1,
        "0",
        true, // tax
        "1",
        { from: alice }
      );

      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      expectEvent(result, "PoolParametersSet", {
        offeringAmountPool: String(offeringAmountPool1),
        raisingAmountPool: String(raisingAmountPool1),
        pid: String(1),
      });

      assert.equal(String(await mockIFO.totalTokensOffered()), String(offeringTotalAmount));

      result = await mockIFO.updatePointParameters(campaignId, numberPoints, thresholdPoints, { from: alice });

      expectEvent(result, "PointParametersSet", {
        campaignId: String(campaignId),
        numberPoints: String(numberPoints),
        thresholdPoints: String(thresholdPoints),
      });
    });

    it("All users are approving the tokens to be spent by the IFO", async () => {
      // Bob, Carol, David, Erin
      for (let thisUser of [bob, carol, david, erin]) {
        await mockLP.approve(mockIFO.address, parseEther("1000"), {
          from: thisUser,
        });
      }

      // 14 generic accounts too
      for (let thisUser of accounts) {
        // Approves LP to be spent by mockIFO
        await mockLP.approve(mockIFO.address, parseEther("1000"), {
          from: thisUser,
        });
      }
    });
  });

  describe("IFO #1 - OVERFLOW FOR BOTH POOLS", async () => {
    it("User cannot deposit without a profile", async () => {
      await expectRevert(
        mockIFO.depositPool(parseEther("0.6"), "0", { from: frank }),
        "Deposit: Must have an active profile"
      );
      await expectRevert(
        mockIFO.depositPool(parseEther("0.6"), "1", { from: frank }),
        "Deposit: Must have an active profile"
      );
    });

    it("User cannot deposit if tokens not deposited", async () => {
      await mockLP.approve(mockIFO.address, parseEther("100000"), {
        from: bob,
      });

      await expectRevert(mockIFO.depositPool(parseEther("0.6"), "0", { from: bob }), "Deposit: Too early");
      await expectRevert(mockIFO.depositPool(parseEther("0.6"), "1", { from: bob }), "Deposit: Too early");

      await time.advanceBlockTo(_startBlock);
    });

    it("User cannot deposit in pools if amount is 0", async () => {
      await expectRevert(mockIFO.depositPool(parseEther("0"), "0", { from: bob }), "Deposit: Amount must be > 0");
      await expectRevert(mockIFO.depositPool(parseEther("0"), "1", { from: bob }), "Deposit: Amount must be > 0");
    });

    it("User cannot deposit in pools that don't exist", async () => {
      await expectRevert(mockIFO.depositPool(parseEther("0"), "2", { from: bob }), "Deposit: Non valid pool id");
    });

    it("User cannot deposit if tokens not deposited", async () => {
      await expectRevert(
        mockIFO.depositPool(parseEther("0.3"), "0", { from: bob }),
        "Deposit: Tokens not deposited properly"
      );
      await expectRevert(
        mockIFO.depositPool(parseEther("0.3"), "1", { from: bob }),
        "Deposit: Tokens not deposited properly"
      );

      // Transfer the offering total amount to the IFO contract
      await mockOC.transfer(mockIFO.address, offeringAmountPool1, {
        from: alice,
      });

      await expectRevert(
        mockIFO.depositPool(parseEther("0.3"), "0", { from: bob }),
        "Deposit: Tokens not deposited properly"
      );
      await expectRevert(
        mockIFO.depositPool(parseEther("0.3"), "1", { from: bob }),
        "Deposit: Tokens not deposited properly"
      );

      // Transfer the offering total amount to the IFO contract
      await mockOC.transfer(mockIFO.address, offeringAmountPool0, {
        from: alice,
      });

      // Verify it is equal
      assert.equal(String(await mockOC.balanceOf(mockIFO.address)), offeringTotalAmount.toString());
    });

    it("User cannot deposit in pool0 if amount higher than the limit", async () => {
      await expectRevert(
        mockIFO.depositPool(parseEther("0.6"), "0", { from: bob }),
        "Deposit: New amount above user limit"
      );
    });

    it("User (Bob) can deposit in pool0", async () => {
      result = await mockIFO.depositPool(parseEther("0.3"), "0", { from: bob });

      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("0.3")),
        pid: String(0),
      });

      result = await mockIFO.viewUserAllocationPools(bob, [0]);
      assert.equal(result[0].toString(), "1000000000000");

      const expectedResult = parseEther("0.3").mul(offeringAmountPool0).div(raisingAmountPool0);

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(bob, [0, 1]);
      assert.equal(result[0][0].toString(), expectedResult.toString());
      assert.equal(result[0][1].toString(), String(parseEther("0")));
      assert.equal(result[0][2].toString(), String(parseEther("0")));
      assert.equal(result[1][0].toString(), String(parseEther("0")));
      assert.equal(result[1][1].toString(), String(parseEther("0")));
      assert.equal(result[1][2].toString(), String(parseEther("0")));

      result = await mockIFO.viewUserInfo(bob, ["0", "1"]);
      assert.equal(result[0][0].toString(), String(parseEther("0.3")));
      assert.equal(await mockLP.balanceOf(mockIFO.address), String(parseEther("0.3")));

      // TOTAL AMOUNT IN POOL0 is 0.3 LP token
      result = await mockIFO.viewPoolInformation(0);
      assert.equal(String(result[4]), String(parseEther("0.3")));
    });

    it("User cannot deposit more in pool0 if new amount + amount > limit", async () => {
      await expectRevert(
        mockIFO.depositPool(parseEther("0.200001"), "0", { from: bob }),
        "Deposit: New amount above user limit"
      );
    });

    it("User (Bob) deposits 0.1 LP ", async () => {
      result = await mockIFO.depositPool(parseEther("0.1"), "0", { from: bob });
      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("0.1")),
        pid: String(0),
      });

      result = await mockIFO.viewUserInfo(bob, ["0", "1"]);
      assert.equal(result[0][0].toString(), String(parseEther("0.4")));
      assert.equal(await mockLP.balanceOf(mockIFO.address), String(parseEther("0.4")));

      // TOTAL AMOUNT IN POOL0 is 0.4 LP token
      result = await mockIFO.viewPoolInformation(0);
      assert.equal(String(result[4]), String(parseEther("0.4")));
    });

    it("User (Carol) deposits in pool0", async () => {
      await mockIFO.depositPool(parseEther("0.5"), "0", { from: carol });

      result = await mockIFO.viewUserAllocationPools(bob, [0]);
      assert.equal(result[0].toString(), "444444444444");

      result = await mockIFO.viewUserAllocationPools(carol, [0]);
      assert.equal(result[0].toString(), "555555555555");

      const expectedResult = parseEther("0.5").mul(offeringAmountPool0).div(raisingAmountPool0);

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(carol, [0, 1]);
      assert.equal(result[0][0].toString(), expectedResult.toString());
      assert.equal(result[0][1].toString(), String(parseEther("0")));
      assert.equal(result[0][2].toString(), String(parseEther("0")));
      assert.equal(result[1][0].toString(), String(parseEther("0")));
      assert.equal(result[1][1].toString(), String(parseEther("0")));
      assert.equal(result[1][2].toString(), String(parseEther("0")));

      result = await mockIFO.viewUserInfo(carol, ["0", "1"]);
      assert.equal(result[0][0].toString(), String(parseEther("0.5")));
      assert.equal(await mockLP.balanceOf(mockIFO.address), String(parseEther("0.9")));

      // TOTAL AMOUNT IN POOL0 is 0.9 LP token
      result = await mockIFO.viewPoolInformation(0);
      assert.equal(String(result[4]), String(parseEther("0.9")));
    });

    it("User (David) deposits in pool0", async () => {
      await mockIFO.depositPool(parseEther("0.1"), "0", { from: david });

      // 0.4/1 * 1M = 400,000
      let expectedResult = parseEther("0.4").mul(1e12).div(parseEther("1"));
      result = await mockIFO.viewUserAllocationPools(bob, [0]);
      assert.equal(result[0].toString(), expectedResult.toString());

      // 0.5/1 * 1M = 500,000
      expectedResult = parseEther("0.5").mul(1e12).div(parseEther("1"));
      result = await mockIFO.viewUserAllocationPools(carol, [0]);
      assert.equal(result[0].toString(), expectedResult.toString());

      // 0.1/1 * 1M = 100,000
      expectedResult = parseEther("0.1").mul(1e12).div(parseEther("1"));
      result = await mockIFO.viewUserAllocationPools(david, [0]);
      assert.equal(result[0].toString(), expectedResult.toString());

      expectedResult = parseEther("0.1").mul(offeringAmountPool0).div(raisingAmountPool0);

      // TOTAL AMOUNT IN POOL0 is 1 LP token
      result = await mockIFO.viewPoolInformation(0);
      assert.equal(String(result[4]), String(parseEther("1")));

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(david, [0, 1]);
      assert.equal(result[0][0].toString(), expectedResult.toString());
      assert.equal(result[0][1].toString(), String(parseEther("0")));
      assert.equal(result[0][2].toString(), String(parseEther("0")));
      assert.equal(result[1][0].toString(), String(parseEther("0")));
      assert.equal(result[1][1].toString(), String(parseEther("0")));
      assert.equal(result[1][2].toString(), String(parseEther("0")));

      result = await mockIFO.viewUserInfo(david, ["0", "1"]);
      assert.equal(result[0][0].toString(), String(parseEther("0.1")));
      assert.equal(await mockLP.balanceOf(mockIFO.address), String(parseEther("1")));
    });

    it("14 accounts deposit in pool0", async () => {
      for (let thisUser of accounts) {
        await mockIFO.depositPool(parseEther("0.5"), "0", { from: thisUser });
      }

      // No tax on overflow for pool 1
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("0")), "0");

      // TOTAL AMOUNT IN POOL0 is 0.5 * 14 + 1 = 8 LP tokens
      result = await mockIFO.viewPoolInformation(0);
      assert.equal(String(result[4]), String(parseEther("8")));
    });

    it("User (Bob) can deposit in pool1", async () => {
      result = await mockIFO.depositPool(parseEther("4"), "1", { from: bob });
      expectEvent(result, "Deposit", {
        user: bob,
        amount: String(parseEther("4")),
        pid: String(1),
      });

      result = await mockIFO.viewUserAllocationPools(bob, [1]);
      assert.equal(result[0].toString(), "1000000000000");

      const expectedResult = parseEther("4").mul(offeringAmountPool1).div(raisingAmountPool1);

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(bob, [0, 1]);

      assert.equal(result[1][0].toString(), expectedResult.toString());
      assert.equal(result[1][1].toString(), String(parseEther("0")));
      assert.equal(result[1][2].toString(), String(parseEther("0")));

      result = await mockIFO.viewUserInfo(bob, ["0", "1"]);
      assert.equal(result[0][1].toString(), String(parseEther("4")));
    });

    it("User (Carol) deposits in pool1", async () => {
      result = await mockIFO.depositPool(parseEther("5"), "1", { from: carol });

      expectEvent(result, "Deposit", {
        user: carol,
        amount: String(parseEther("5")),
        pid: String(1),
      });

      // 9 LP
      result = await mockIFO.viewUserAllocationPools(bob, [1]);
      assert.equal(result[0].toString(), "444444444444");

      result = await mockIFO.viewUserAllocationPools(carol, [1]);
      assert.equal(result[0].toString(), "555555555555");

      const expectedResult = parseEther("5").mul(offeringAmountPool1).div(raisingAmountPool1);

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(carol, [0, 1]);

      assert.equal(result[1][0].toString(), expectedResult.toString());

      result = await mockIFO.viewUserInfo(carol, ["0", "1"]);
      assert.equal(result[0][1].toString(), String(parseEther("5")));
    });

    it("User (David) deposits in pool1", async () => {
      await mockIFO.depositPool(parseEther("3"), "1", { from: david });

      // 10 LP
      // 4/12 * 1M = 333,333
      let expectedResult = parseEther("4").mul(1e12).div(parseEther("12"));
      result = await mockIFO.viewUserAllocationPools(bob, [1]);
      assert.equal(result[0].toString(), expectedResult.toString());

      // 5/12 * 1M = 416,666
      expectedResult = parseEther("5").mul(1e12).div(parseEther("12"));
      result = await mockIFO.viewUserAllocationPools(carol, [1]);
      assert.equal(result[0].toString(), expectedResult.toString());

      // 3/12 * 1M = 250,000
      expectedResult = parseEther("3").mul(1e12).div(parseEther("12"));
      result = await mockIFO.viewUserAllocationPools(david, [1]);
      assert.equal(result[0].toString(), expectedResult.toString());

      expectedResult = parseEther("3").mul(offeringAmountPool1).div(raisingAmountPool1);

      result = await mockIFO.viewUserOfferingAndRefundingAmountsForPools(david, [0, 1]);
      assert.equal(result[1][0].toString(), expectedResult.toString());

      result = await mockIFO.viewUserInfo(david, ["0", "1"]);
      assert.equal(result[0][1].toString(), String(parseEther("3")));
    });

    it("Whale (account 0) deposits 88 LP in pool1", async () => {
      const amountDeposit = parseEther("88");
      await mockIFO.depositPool(amountDeposit, "1", { from: accounts[0] });

      // Tax overflow is 1%
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      // NEW TOTAL AMOUNT IN POOL1 is 88 + 12 = 100 LP tokens
      result = await mockIFO.viewPoolInformation(1);
      assert.equal(String(result[4]), String(parseEther("100")));

      let expectedResult = amountDeposit.mul(1e12).div(parseEther("100"));
      result = await mockIFO.viewUserAllocationPools(accounts[0], [1]);
      assert.equal(result[0].toString(), expectedResult.toString());
    });

    it("Whale (account 1) deposits 300 LP in pool1", async () => {
      const amountDeposit = parseEther("300");
      await mockIFO.depositPool(amountDeposit, "1", { from: accounts[1] });

      // Tax overflow is 1%
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      // NEW TOTAL AMOUNT IN POOL1 is 300 + 100 = 400 LP tokens
      result = await mockIFO.viewPoolInformation(1);
      assert.equal(String(result[4]), String(parseEther("400")));

      let expectedResult = amountDeposit.mul(1e12).div(parseEther("400"));
      result = await mockIFO.viewUserAllocationPools(accounts[1], [1]);
      assert.equal(result[0].toString(), expectedResult.toString());
    });

    it("Whale (account 2) deposits 600 LP in pool1", async () => {
      const amountDeposit = parseEther("600");
      await mockIFO.depositPool(amountDeposit, "1", { from: accounts[2] });

      // Tax overflow is 1.00%
      assert.equal(String(await mockIFO.viewPoolTaxRateOverflow("1")), "10000000000");

      // NEW TOTAL AMOUNT IN POOL1 is 600 + 400 = 1,000 LP tokens
      result = await mockIFO.viewPoolInformation(1);
      assert.equal(String(result[4]), String(parseEther("1000")));

      let expectedResult = amountDeposit.mul(1e12).div(parseEther("1000"));
      result = await mockIFO.viewUserAllocationPools(accounts[2], [1]);
      assert.equal(result[0].toString(), expectedResult.toString());
    });

    it("Cannot harvest before end of the IFO", async () => {
      await expectRevert(mockIFO.harvestPool("0", { from: bob }), "Harvest: Too early");
      await time.advanceBlockTo(_endBlock);
    });

    it("Cannot harvest with wrong pool id", async () => {
      await expectRevert(mockIFO.harvestPool("2", { from: bob }), "Harvest: Non valid pool id");
    });

    it("Cannot deposit to any of the pools", async () => {
      await expectRevert(mockIFO.depositPool(parseEther("1"), "0", { from: bob }), "Deposit: Too late");
      await expectRevert(mockIFO.depositPool(parseEther("1"), "1", { from: bob }), "Deposit: Too late");
    });

    it("Cannot harvest if didn't participate", async () => {
      await expectRevert(mockIFO.harvestPool("0", { from: frank }), "Harvest: Did not participate");
      await expectRevert(mockIFO.harvestPool("1", { from: frank }), "Harvest: Did not participate");
    });

    it("Bob harvests for pool0", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(bob));
      const previousLPBalance = new BN(await mockLP.balanceOf(bob));

      result = await mockIFO.harvestPool("0", { from: bob });

      // Bob contributed 0.4 LP tokens out of 8 LP tokens deposited
      // Tax rate on overflow amount is 0.0%
      // 5 LP tokens were raised.
      // 0.4 * 5/8 = 0.25 LP tokens were raised
      // 0.25 LP token gets consumed // 0.4 - 0.25 = 0.15 LP returns
      // 0.25 LP * 10 --> 2.5 tokens received

      expectEvent(result, "Harvest", {
        user: bob,
        offeringAmount: String(parseEther("2.5")),
        excessAmount: String(parseEther("0.15")),
        pid: "0",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, pancakeProfile, "UserPointIncrease", {
        userAddress: bob,
        numberPoints: String(numberPoints),
        campaignId: String(campaignId),
      });

      // Verify user balances changed accordingly
      const newOCBalance = new BN(await mockOC.balanceOf(bob));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(bob));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("2.5")));
      assert.equal(String(changeLPBalance), String(parseEther("0.15")));

      // Verify user has claimed for only one of the pools
      result = await mockIFO.viewUserInfo(bob, ["0", "1"]);
      assert.equal(result[1][0], true);
      assert.equal(result[1][1], false);
    });

    it("Cannot harvest twice", async () => {
      await expectRevert(mockIFO.harvestPool("0", { from: bob }), "Harvest: Already done");
    });

    it("Carol harvests for pool0", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(carol));
      const previousLPBalance = new BN(await mockLP.balanceOf(carol));

      result = await mockIFO.harvestPool("0", { from: carol });

      // Carol contributed 0.5 LP tokens out of 8 LP tokens deposited
      // Tax rate on overflow amount is 0.0%
      // 5 LP tokens were raised.
      // 0.5 * 5/8 = 0.3125 LP tokens were raised
      // 0.3125 LP token gets consumed // 0.5 - 0.3125 = 0.1875 LP returns
      // 0.3125 LP * 10 --> 3.125 tokens received

      expectEvent(result, "Harvest", {
        user: carol,
        offeringAmount: String(parseEther("3.125")),
        excessAmount: String(parseEther("0.1875")),
        pid: "0",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, pancakeProfile, "UserPointIncrease", {
        userAddress: carol,
        numberPoints: String(numberPoints),
        campaignId: String(campaignId),
      });

      // Verify user balances changed accordingly
      const newOCBalance = new BN(await mockOC.balanceOf(carol));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(carol));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("3.125")));
      assert.equal(String(changeLPBalance), String(parseEther("0.1875")));

      // Verify user has claimed for only one of the pools
      result = await mockIFO.viewUserInfo(carol, ["0", "1"]);
      assert.equal(result[1][0], true);
      assert.equal(result[1][1], false);
    });

    it("Bob harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(bob));
      const previousLPBalance = new BN(await mockLP.balanceOf(bob));

      result = await mockIFO.harvestPool("1", { from: bob });

      // Bob contributed 4 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 0.4 LP token gets consumed // 3.6 * (1 - 1%) = 3.564 LP returns
      // 0.4 LP --> 4 tokens received

      expectEvent(result, "Harvest", {
        user: bob,
        offeringAmount: String(parseEther("4")),
        excessAmount: String(parseEther("3.564")),
        pid: "1",
      });

      // Verify Bob has not collected points twice
      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, pancakeProfile, "UserPointIncrease");

      const newOCBalance = new BN(await mockOC.balanceOf(bob));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(bob));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("4")));
      assert.equal(String(changeLPBalance), String(parseEther("3.564")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(bob, ["0", "1"]);
      assert.equal(result[1][0], true);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);
      // 3.6 - 3.564 = 0.036
      assert.equal(String(result[5]), String(parseEther("0.036")));
    });

    it("Cannot harvest twice", async () => {
      await expectRevert(mockIFO.harvestPool("1", { from: bob }), "Harvest: Already done");
    });

    it("Carol harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(carol));
      const previousLPBalance = new BN(await mockLP.balanceOf(carol));

      result = await mockIFO.harvestPool("1", { from: carol });

      // Carol contributed 5 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 0.5 LP token gets consumed // 4.5 * (1 - 1%) = 4.455 LP returns
      // 0.5 LP --> 5 tokens received

      expectEvent(result, "Harvest", {
        user: carol,
        offeringAmount: String(parseEther("5")),
        excessAmount: String(parseEther("4.455")),
        pid: "1",
      });

      // Verify Carol has not collected points twice
      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, pancakeProfile, "UserPointIncrease");

      const newOCBalance = new BN(await mockOC.balanceOf(carol));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(carol));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("5")));
      assert.equal(String(changeLPBalance), String(parseEther("4.455")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(carol, ["0", "1"]);
      assert.equal(result[1][0], true);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);
      // 0.036 + (4.5 - 4.455) = 0.081
      assert.equal(String(result[5]), String(parseEther("0.081")));
    });

    it("David harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(david));
      const previousLPBalance = new BN(await mockLP.balanceOf(david));

      result = await mockIFO.harvestPool("1", { from: david });

      // David contributed 3 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 0.3 LP token gets consumed // 2.7 * (1 - 1%) = 2.673 LP returns
      // 0.3 LP --> 3 tokens received

      expectEvent(result, "Harvest", {
        user: david,
        offeringAmount: String(parseEther("3")),
        excessAmount: String(parseEther("2.673")),
        pid: "1",
      });

      const newOCBalance = new BN(await mockOC.balanceOf(david));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(david));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("3")));
      assert.equal(String(changeLPBalance), String(parseEther("2.673")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(david, ["0", "1"]);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);
      // 0.081 + (2.7 - 2.673) = 0.054
      assert.equal(String(result[5]), String(parseEther("0.108")));
    });

    it("Whale (account 0) harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(accounts[0]));
      const previousLPBalance = new BN(await mockLP.balanceOf(accounts[0]));

      result = await mockIFO.harvestPool("1", { from: accounts[0] });

      // Whale contributed 88 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 8.8 LP token gets consumed // 79.2 * (1 - 1%) = 78.408 LP returns
      // 8.8 LP --> 88 tokens received

      expectEvent(result, "Harvest", {
        user: accounts[0],
        offeringAmount: String(parseEther("88")),
        excessAmount: String(parseEther("78.408")),
        pid: "1",
      });

      const newOCBalance = new BN(await mockOC.balanceOf(accounts[0]));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(accounts[0]));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("88")));
      assert.equal(String(changeLPBalance), String(parseEther("78.408")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(accounts[0], ["0", "1"]);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);

      // 0.108 + (79.2 - 78.408) = 0.9
      assert.equal(String(result[5]), String(parseEther("0.9")));
    });

    it("Whale (account 1) harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(accounts[1]));
      const previousLPBalance = new BN(await mockLP.balanceOf(accounts[1]));

      result = await mockIFO.harvestPool("1", { from: accounts[1] });

      // Whale contributed 300 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 30 LP token gets consumed // 270 * (1 - 1%) = 267.3 LP returns
      // 30 LP --> 300 tokens received

      expectEvent(result, "Harvest", {
        user: accounts[1],
        offeringAmount: String(parseEther("300")),
        excessAmount: String(parseEther("267.3")),
        pid: "1",
      });

      const newOCBalance = new BN(await mockOC.balanceOf(accounts[1]));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(accounts[1]));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("300")));
      assert.equal(String(changeLPBalance), String(parseEther("267.3")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(accounts[1], ["0", "1"]);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);

      // 0.9 + 2.7 = 3.6
      assert.equal(String(result[5]), String(parseEther("3.6")));
    });

    it("Whale (account 2) harvests for pool1", async () => {
      const previousOCBalance = new BN(await mockOC.balanceOf(accounts[2]));
      const previousLPBalance = new BN(await mockLP.balanceOf(accounts[2]));

      result = await mockIFO.harvestPool("1", { from: accounts[2] });

      // Whale contributed 600 LP tokens out of 1,000 LP tokens deposited
      // Tax rate on overflow amount is 1%
      // 60 LP token gets consumed // 540 * (1 - 1%) = 534.6 LP returns
      // 60 LP --> 600 tokens received

      expectEvent(result, "Harvest", {
        user: accounts[2],
        offeringAmount: String(parseEther("600")),
        excessAmount: String(parseEther("534.6")),
        pid: "1",
      });

      const newOCBalance = new BN(await mockOC.balanceOf(accounts[2]));
      const changeOCBalance = newOCBalance.sub(previousOCBalance);
      const newLPBalance = new BN(await mockLP.balanceOf(accounts[2]));
      const changeLPBalance = newLPBalance.sub(previousLPBalance);

      assert.equal(String(changeOCBalance), String(parseEther("600")));
      assert.equal(String(changeLPBalance), String(parseEther("534.6")));

      // Verify user has claimed
      result = await mockIFO.viewUserInfo(accounts[2], ["0", "1"]);
      assert.equal(result[1][1], true);

      // Verify that the sumTaxesOverflow has increased
      result = await mockIFO.viewPoolInformation(1);

      // 3.6 + 5.4 = 9
      assert.equal(String(result[5]), String(parseEther("9")));
    });
  });

  describe("IFO - ADMIN FUNCTIONS", async () => {
    it("Admin can withdraw funds", async () => {
      let amountToWithdraw = await mockIFO.viewPoolInformation(1);
      amountToWithdraw = new BN(amountToWithdraw[5]);

      // Withdraw LP raised + TAX OVERFLOW
      amountToWithdraw = amountToWithdraw.add(new BN(raisingAmountTotal.toString()));

      result = await mockIFO.finalWithdraw(amountToWithdraw, "0", { from: alice });

      expectEvent(result, "AdminWithdraw", { amountLP: String(amountToWithdraw), amountOfferingToken: "0" });

      expectEvent.inTransaction(result.receipt.transactionHash, mockLP, "Transfer", {
        from: mockIFO.address,
        to: alice,
        value: String(amountToWithdraw),
      });
    });

    it("It is not possible to change IFO start/end blocks after start", async () => {
      await expectRevert(mockIFO.updateStartAndEndBlocks("1", "2", { from: alice }), "Operations: IFO has started");
    });

    it("It is not possible to change IFO parameters after start", async () => {
      await expectRevert(
        mockIFO.setPool(
          "0",
          "0",
          "0",
          false, // tax
          "0",
          { from: alice }
        ),
        "Operations: IFO has started"
      );

      await expectRevert(
        mockIFO.setPool(
          "0",
          "0",
          "0",
          false, // tax
          "0",
          { from: alice }
        ),
        "Operations: IFO has started"
      );
    });

    it("It is not possible to change point parameters after start", async () => {
      await expectRevert(
        mockIFO.updatePointParameters(campaignId, numberPoints, thresholdPoints, { from: alice }),
        "Operations: IFO has ended"
      );
    });

    it("Owner can recover funds if wrong token", async () => {
      // Deploy Wrong LP
      const wrongLP = await MockBEP20.new("Wrong LP", "LP", "100", {
        from: alice,
      });

      // Transfer wrong LP by "accident"
      await wrongLP.transfer(mockIFO.address, "1");

      result = await mockIFO.recoverWrongTokens(wrongLP.address, "1", { from: alice });

      expectEvent(result, "AdminTokenRecovery", { tokenAddress: wrongLP.address, amountTokens: "1" });

      await expectRevert(
        mockIFO.recoverWrongTokens(mockOC.address, "1", { from: alice }),
        "Recover: Cannot be offering token"
      );
      await expectRevert(
        mockIFO.recoverWrongTokens(mockLP.address, "1", { from: alice }),
        "Recover: Cannot be LP token"
      );
    });

    it("Only owner can call functions for admin", async () => {
      await expectRevert(mockIFO.finalWithdraw("0", "1", { from: carol }), "Ownable: caller is not the owner");
      await expectRevert(
        mockIFO.setPool(
          offeringAmountPool0,
          raisingAmountPool1,
          limitPerUserInLp,
          false, // tax
          "0",
          { from: carol }
        ),
        "Ownable: caller is not the owner"
      );
      await expectRevert(
        mockIFO.updatePointParameters("1", "1", "1", { from: carol }),
        "Ownable: caller is not the owner"
      );
      await expectRevert(
        mockIFO.recoverWrongTokens(mockOC.address, "1", { from: carol }),
        "Ownable: caller is not the owner"
      );
      await expectRevert(
        mockIFO.updateStartAndEndBlocks("1", "2", { from: carol }),
        "Ownable: caller is not the owner"
      );
    });
  });
});
