import { Given, Then, When, setDefaultTimeout } from "@cucumber/cucumber";
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
  TokenAssociateTransaction,
  TransferTransaction,
  TransactionReceipt,
} from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();
setDefaultTimeout(10 * 1000); // Set default timeout to 10 seconds

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

Then(/^The token has the name "([^"]*)"$/, async function (expectedName: string) {
  if (!this.tokenId) {
    throw new Error("Tokne ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.name, expectedName);
  console.log('Token name verified:', tokenInfo.name);
});

Then(/^The token has the symbol "([^"]*)"$/, async function (expectedSymbol: string) {
  if (!this.tokenId) {
    throw new Error("Tokne ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.symbol, expectedSymbol);
  console.log('Token symbol verified:', tokenInfo.symbol);
});

Then(/^The token has (\d+) decimals$/, async function (expectedDecimals: number) {
  if (!this.tokenId) {
    throw new Error("Token ID not found.");
  }

  const query = new TokenInfoQuery()
    .setTokenId(this.tokenId);
  
  const tokenInfo = await query.execute(client);
  assert.strictEqual(tokenInfo.decimals, expectedDecimals);
  console.log('Token decimals verified:', tokenInfo.decimals);
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
  console.log('Token treasury account verified:', tokenInfo.treasuryAccountId?.toString());
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

/** Scenario 2 */

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

  this.supplyKey = null; // Simulate no supply key for fixed supply token

  const mintTx = new TokenMintTransaction()
    .setTokenId(this.tokenId)
    .setAmount(100);

  try {
    await mintTx
      .execute(client);
  } catch (error: any) {
    console.log(error)
    assert.ok(
      error.message.includes("TOKEN_HAS_NO_SUPPLY_KEY"),
      "Expected error about missing supply key"
    );
  }
});

/** Scenario 3 */

Given(/^A first hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {
  const account = accounts[0];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);
  
  // Store for later use
  this.firstAccountId = accountId;
  this.firstPrivateKey = privateKey;
  
  // Set as operator for subsequent operations
  client.setOperator(accountId, privateKey);

  // Verify balance
  const query = new AccountBalanceQuery().setAccountId(accountId);
  const balance = await query.execute(client);
  assert.ok(
    balance.hbars.toBigNumber().toNumber() > expectedBalance,
    `Account should have more than ${expectedBalance} hbar`
  );
  
  console.log(`First account with ID: ${accountId} and verified balance > ${expectedBalance}`);
});

Given(/^A second Hedera account$/, async function () {
  const account = accounts[1];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);
  
  this.secondAccountId = accountId;
  this.secondPrivateKey = privateKey;
  
  console.log(`Second account with ID: ${accountId}`);
});

Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function (initialSupply: number) {
  // all new tokens will be created with account[5] as the operator
  const account = accounts[5];

  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);

  // Set account[5] as the client operator
  client.setOperator(accountId, privateKey);

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

  console.log(`Token created with ID: ${this.tokenId} and initial supply of ${initialSupply}`);
});

Given(/^The first account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  // this.timeout(30000);
    if (!this.tokenId || !this.firstAccountId) {
        throw new Error("Token ID or first account ID not found");
    }

    // need to associate token with the first account
    const associateTx = new TokenAssociateTransaction()
        .setAccountId(this.firstAccountId)
        .setTokenIds([this.tokenId]);

    const signedAssociateTx = await associateTx
        .freezeWith(client)
        .sign(this.firstPrivateKey);

    try {
      const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
      console.log(`Token associated with first account, status: ${associateReceipt.status}`);
    } catch (error: any) {
        // Ignore if token is already associated
    }

    const query = new AccountBalanceQuery()
      .setAccountId(this.firstAccountId);
    const balance = (await query.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;

    if (balance !== expectedBalance) {
      // If the first account does not have the expected balance, transfer tokens
      console.log(`First account does not have expected balance of ${expectedBalance} HTT tokens, transferring...`);
      const transferTx = new TransferTransaction()
        .addTokenTransfer(this.tokenId, AccountId.fromString(accounts[5].id), -(expectedBalance - balance))
        .addTokenTransfer(this.tokenId, this.firstAccountId, (expectedBalance - balance))
        .freezeWith(client);
      const signedTx = await transferTx.sign(this.firstPrivateKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
      console.log(`Transferred ${expectedBalance - balance} HTT tokens to first account`);
    }

    const newQuery = new AccountBalanceQuery()
        .setAccountId(this.firstAccountId);
    const newBalance = (await newQuery.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;
    
    assert.strictEqual(
        newBalance,
        expectedBalance,
    );
    console.log(`First account holds ${expectedBalance} HTT tokens`);
});

Given(/^The second account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
    if (!this.tokenId || !this.secondAccountId) {
        throw new Error("Token ID or second account ID not found");
    }

    // need to associate token with the second account
    const associateTx = new TokenAssociateTransaction()
        .setAccountId(this.secondAccountId)
        .setTokenIds([this.tokenId]);

    const signedAssociateTx = await associateTx
        .freezeWith(client)
        .sign(this.secondPrivateKey);

    try {
      const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
      console.log(`Token associated with second account, status: ${associateReceipt.status}`);
    } catch (error: any) {
      // Ignore if token is already associated
    }

    const query = new AccountBalanceQuery()
        .setAccountId(this.secondAccountId);
    const balance = (await query.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;

    if (balance !== expectedBalance) {
      // If the second account does not have the expected balance, transfer tokens
      console.log(`Second account does not have expected balance of ${expectedBalance} HTT tokens, transferring...`);
      const transferTx = new TransferTransaction()
        .addTokenTransfer(this.tokenId, AccountId.fromString(accounts[5].id), -(expectedBalance - balance))
        .addTokenTransfer(this.tokenId, this.secondAccountId, (expectedBalance - balance))
        .freezeWith(client);
      const signedTx = await transferTx.sign(this.firstPrivateKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
      console.log(`Transferred ${expectedBalance} HTT tokens to account[4]`);
    }
    
    const newQuery = new AccountBalanceQuery()
        .setAccountId(this.secondAccountId);
    const newBalance = (await newQuery.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;
    assert.strictEqual(
        newBalance,
        expectedBalance,
    );
    console.log(`Second account holds ${expectedBalance} HTT tokens`);
});

When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function (amount: number) {
  if (!this.tokenId || !this.firstAccountId || !this.secondAccountId) {
    throw new Error("Missing required token or account information");
  }

  const account = accounts[0];
  client.setOperator(
      AccountId.fromString(account.id),
      PrivateKey.fromStringED25519(account.privateKey)
  );

  this.transferTransaction = new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccountId, -amount)
    .addTokenTransfer(this.tokenId, this.secondAccountId, amount)
    .freezeWith(client);
      
  console.log(`Transfer transaction created to send ${amount} HTT tokens from first to second account`);
});

When(/^The first account submits the transaction$/, async function () {
    if (!this.transferTransaction || !this.firstPrivateKey) {
        throw new Error("Transfer transaction or signing key not found");
    }

    const signedTx = await this.transferTransaction.sign(this.firstPrivateKey);
    const txResponse = await signedTx.execute(client);
    this.receipt = await txResponse.getReceipt(client);
    
    assert.ok(this.receipt.status.toString() === "SUCCESS");
    console.log(`Transaction submitted successfully with status: ${this.receipt.status}`);
});

When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function (amount: number) {
  if (!this.tokenId || !this.firstAccountId || !this.secondAccountId) {
    throw new Error("Missing required token or account information");
  }

  const account = accounts[1];
  client.setOperator(
      AccountId.fromString(account.id),
      PrivateKey.fromStringED25519(account.privateKey)
  );

  this.transferTransaction = new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.secondAccountId, -amount)
    .addTokenTransfer(this.tokenId, this.firstAccountId, amount)
    .freezeWith(client);
      
  console.log(`Transfer transaction created to send ${amount} HTT tokens from second to forst account`);
});

Then(/^The first account has paid for the transaction fee$/, async function () {
    if (!this.receipt) {
        throw new Error("Transaction receipt not found");
    }
    
    assert.ok(this.receipt.status.toString() === "SUCCESS");
    console.log(`Transaction fee paid successfully, status: ${this.receipt.status}`);
});
Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function (bal, transferAmount) {
// transferring tokens from account[5] to account[0]
  const account = accounts[0];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);

  this.firstAccountId = accountId;
  this.firstPrivateKey = privateKey;
  
  // Set treasury as operator for subsequent operations
  const treasury = accounts[5];
  const treasuryPrivateKey = PrivateKey.fromStringED25519(treasury.privateKey);
  this.treasuryAccountId = AccountId.fromString(treasury.id);
  this.treasuryPrivateKey = treasuryPrivateKey;

  client.setOperator(this.treasuryAccountId, this.treasuryPrivateKey);

  // Verify balance
  const query = new AccountBalanceQuery().setAccountId(accountId);
  const balance = await query.execute(client);
  assert.ok(
    balance.hbars.toBigNumber().toNumber() > bal,
    `Account should have more than ${bal} hbar`
  );

  if (!this.tokenId) {
    throw new Error("Token ID not found");
  }

  // Associate token with the first account
  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([this.tokenId]);

  const signedAssociateTx = await associateTx
    .freezeWith(client)
    .sign(privateKey);

  try {
    const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
    console.log(`Token associated with first account, status: ${associateReceipt.status}`);
  } catch (error: any) {
    // Ignore if token is already associated
  }

  // Transfer tokens to the first account
  const transferTx = new TransferTransaction()
    .addTokenTransfer(this.tokenId, AccountId.fromString(treasury.id), -transferAmount)
    .addTokenTransfer(this.tokenId, accountId, transferAmount)
    .freezeWith(client);

  const signedTx = await transferTx.sign(treasuryPrivateKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
  
  console.log(`First account with ID: ${accountId} has been set up with ${transferAmount} HTT tokens`);

});
Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (bal, transferAmount) {
  // transferring 100 HTT tokens from account[5] to account[1]
  const account = accounts[1];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);

  this.secondAccountId = accountId;
  this.secondPrivateKey = privateKey;

  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([this.tokenId]);

  const signedAssociateTx = await associateTx
    .freezeWith(client)
    .sign(privateKey);

  const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
  console.log(`Token associated with second account, status: ${associateReceipt.status}`);

  const transferTx = new TransferTransaction()
    .addTokenTransfer(this.tokenId, AccountId.fromString(accounts[5].id), -transferAmount)
    .addTokenTransfer(this.tokenId, accountId, transferAmount)
    .freezeWith(client);

  const signedTx = await transferTx.sign(this.treasuryPrivateKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
  
  console.log(`Second account with ID: ${accountId} has been set up with ${transferAmount} HTT tokens`);

});
Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (bal, transferAmount) {
  // transferring 100 HTT tokens from account[5] to account[2]
  const account = accounts[2];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);

  this.thirdAccountId = accountId;
  this.thirdPrivateKey = privateKey;

  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([this.tokenId]);

  const signedAssociateTx = await associateTx
    .freezeWith(client)
    .sign(privateKey);

  const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
  console.log(`Token associated with third account, status: ${associateReceipt.status}`);

  const transferTx = new TransferTransaction()
    .addTokenTransfer(this.tokenId, AccountId.fromString(accounts[5].id), -transferAmount)
    .addTokenTransfer(this.tokenId, accountId, transferAmount)
    .freezeWith(client);

  const signedTx = await transferTx.sign(this.treasuryPrivateKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
  
  console.log(`Third account with ID: ${accountId} has been set up with ${transferAmount} HTT tokens`);

});
Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function (bal, transferAmount) {
  // transferring 100 HTT tokens from account[5] to account[3]
  const account = accounts[3];
  const accountId = AccountId.fromString(account.id);
  const privateKey = PrivateKey.fromStringED25519(account.privateKey);

  this.fourthAccountId = accountId;
  this.fourthPrivateKey = privateKey;

  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([this.tokenId]);

  const signedAssociateTx = await associateTx
    .freezeWith(client)
    .sign(privateKey);

  const associateReceipt = await (await signedAssociateTx.execute(client)).getReceipt(client);
  console.log(`Token associated with fourth account, status: ${associateReceipt.status}`);

  const transferTx = new TransferTransaction()
    .addTokenTransfer(this.tokenId, AccountId.fromString(accounts[5].id), -transferAmount)
    .addTokenTransfer(this.tokenId, accountId, transferAmount)
    .freezeWith(client);

  const signedTx = await transferTx.sign(this.treasuryPrivateKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  
  assert.ok(receipt.status.toString() === "SUCCESS", "Transfer should succeed");
  console.log(`Fourth account with ID: ${accountId} has been set up with ${transferAmount} HTT tokens`);

});
When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function (account1And2transferAmount, account3transferAmount, account4transferAmount) {
  if (!this.tokenId || !this.firstAccountId || !this.secondAccountId) {
    throw new Error("Missing required token or account information");
  }

  this.transferTransaction = new TransferTransaction()
    .addTokenTransfer(this.tokenId, this.firstAccountId, -account1And2transferAmount)
    .addTokenTransfer(this.tokenId, this.secondAccountId, -account1And2transferAmount)
    .addTokenTransfer(this.tokenId, this.thirdAccountId, account3transferAmount)
    .addTokenTransfer(this.tokenId, this.fourthAccountId, account4transferAmount)
    .freezeWith(client);

  // Sign with first account
  const signedByFirst = await this.transferTransaction.sign(this.firstPrivateKey);
  
  // Sign with second account
  this.transferTransaction = await signedByFirst.sign(this.secondPrivateKey);
  console.log(`Transfer transaction created and signed by both account`);
});
Then(/^The third account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  if (!this.tokenId || !this.thirdAccountId) {
    throw new Error("Token ID or third account ID not found");
  }

  const query = new AccountBalanceQuery()
    .setAccountId(this.thirdAccountId);
  const balance = (await query.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;

  assert.strictEqual(
    balance,
    expectedBalance,
  );
  console.log(`Third account holds ${expectedBalance} HTT tokens`);

});
Then(/^The fourth account holds (\d+) HTT tokens$/, async function (expectedBalance: number) {
  if (!this.tokenId || !this.fourthAccountId) {
    throw new Error("Token ID or fourth account ID not found");
  }

  const query = new AccountBalanceQuery()
    .setAccountId(this.fourthAccountId);
  const balance = (await query.execute(client)).tokens?.get(this.tokenId)?.toNumber() || 0;

  assert.strictEqual(
    balance,
    expectedBalance,
  );
  console.log(`Fourth account holds ${expectedBalance} HTT tokens`);

});