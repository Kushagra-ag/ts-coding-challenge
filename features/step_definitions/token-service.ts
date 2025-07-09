import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { 
  AccountBalanceQuery, 
  AccountId, 
  Client, 
  PrivateKey,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
} from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet()

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0]
  const MY_ACCOUNT_ID = AccountId.fromString(account.id);
  const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)

});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const account = accounts[0];
  // Creating a dedicated supply key
  const supplyKey = PrivateKey.generateED25519();
  this.supplyKey = supplyKey;

  const transaction = new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(2)
    .setInitialSupply(0)
    .setTreasuryAccountId(AccountId.fromString(account.id))
    .setSupplyKey(supplyKey);

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);
  this.tokenId = receipt.tokenId;

  console.log(`Token created with ID: ${this.tokenId}`);
});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function (initialSupply: number) {
  const account = accounts[0];
  
  const transaction = new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setDecimals(2)
    .setInitialSupply(initialSupply)
    .setTreasuryAccountId(AccountId.fromString(account.id));
    // No supply key provided making this a fixed supply token

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);
  this.tokenId = receipt.tokenId;

  console.log(`Fixed supply token created with ID: ${this.tokenId}`);
});

Then(/^The token has the name "([^"]*)"$/, async function (expectedName: string) {
  if (!this.tokenId) {
    throw new Error("Tokne ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.name, expectedName);
  console.log('Token name verified', tokenInfo.name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (expectedSymbol: string) {
  if (!this.tokenId) {
    throw new Error("Tokne ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.symbol, expectedSymbol);
  console.log('Token symbol verified', tokenInfo.symbol);
});

Then(/^The token has (\d+) decimals$/, async function (expectedDecimals: number) {
  if (!this.tokenId) {
    throw new Error("Token ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.decimals, expectedDecimals);
  console.log('Token decimals verified', tokenInfo.decimals);
});

Then(/^The token is owned by the account$/, async function () {
  if (!this.tokenId) {
    throw new Error("Token ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(
    tokenInfo.treasuryAccountId?.toString(), 
    accounts[0].id
  );
  console.log('Token treasury account verified', tokenInfo.treasuryAccountId?.toString());
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function (amount: number) {
  if (!this.tokenId || !this.supplyKey) {
    throw new Error("Both token id and supply key are required");
  }

  const mintTx = new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(amount);

  // Need to sign with the supply key
  const txResponse = await mintTx
    .freezeWith(client)
    .sign(this.supplyKey);
    
  const result = await txResponse.execute(client);
  const receipt = await result.getReceipt(client);
  assert.ok(receipt.status.toString() === "SUCCESS", "Minting should succeed");
  console.log(`Minted ${amount} tokens to ${this.tokenId}`);
});

Then(/^The total supply of the token is (\d+)$/, async function (expectedSupply: number) {
  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(
    tokenInfo.totalSupply.toNumber(),
    expectedSupply,
  );
  console.log(`Token total supply verified: ${tokenInfo.totalSupply.toNumber()}`);
});

Then(/^An attempt to mint tokens fails$/, async function () {
  if (!this.tokenId) {
    throw new Error("Fixed supply token ID not found");
  }

  const mintTx = new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(100);

  try {
    const a = await mintTx.execute(client);
    await mintTx
      .freezeWith(client)
      .execute(client);
  } catch (error: any) {
    console.log(error)
    assert.ok(
      error.message.includes("TOKEN_HAS_NO_SUPPLY_KEY"),
      "Expected error about missing supply key"
    );
    console.log("Minting failed as expected due to missing supply key");
  }
});

Given(/^A first hedera account with more than (\d+) hbar$/, async function () {

});
Given(/^A second Hedera account$/, async function () {

});
Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function () {

});
Given(/^The first account holds (\d+) HTT tokens$/, async function () {

});
Given(/^The second account holds (\d+) HTT tokens$/, async function () {

});
When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function () {

});
When(/^The first account submits the transaction$/, async function () {

});
When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function () {

});
Then(/^The first account has paid for the transaction fee$/, async function () {

});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function () {

});
Then(/^The third account holds (\d+) HTT tokens$/, async function () {

});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function () {

});
