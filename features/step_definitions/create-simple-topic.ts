import { Given, Then, When } from "@cucumber/cucumber";
import {
  AccountBalanceQuery,
  AccountId,
  Client,
  PrivateKey, RequestType,
  PublicKey,
  TopicCreateTransaction, TopicInfoQuery,
  TopicMessageQuery, TopicMessageSubmitTransaction,
  KeyList
} from "@hashgraph/sdk";
import { accounts } from "../../src/config";
import assert from "node:assert";
import ConsensusSubmitMessage = RequestType.ConsensusSubmitMessage;

// Pre-configured client for test network (testnet)
const client = Client.forTestnet()

//Set the operator with the account ID and private key

Given(/^a first account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[0]
  const account: AccountId = AccountId.fromString(acc.id);
  this.account = account
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.privKey = privKey
  client.setOperator(this.account, privKey);

//Create the query request
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client)
  console.log(`First account balance: ${balance.hbars.toString()}`);
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

When(/^A topic is created with the memo "([^"]*)" with the first account as the submit key$/, async function (memo: string) {
  const transaction = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(this.privKey.publicKey)
    .execute(client);

  const receipt = await transaction.getReceipt(client);
  const topicId = receipt.topicId;

  // Store the topic ID for later steps
  this.topicId = topicId;
  console.log(`Topic created with ID: ${topicId}`);
});

When(/^The message "([^"]*)" is published to the topic$/, async function (message: string) {
  if (!this.topicId) {
    throw new Error("Topic ID not found.");
  }

  // Submit the message to the topic
  const submitTx = await new TopicMessageSubmitTransaction()
    .setTopicId(this.topicId)
    .setMessage(message)
    .execute(client);
});

Then(/^The message "([^"]*)" is received by the topic and can be printed to the console$/, async function (message: string) {
  if (!this.topicId) {
    throw new Error("Topic ID not found.");
  }

  // need to wait for couple seconds to ensure the message is propagated
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Set the start time to 50 seconds ago to ensure we capture the message
  const startTime = new Date(Date.now() - 50000);

  let received = false;
  await new Promise<void>((resolve, reject) => {
    console.log("Waiting for message on topic:", this.topicId.toString());
    const subscription = new TopicMessageQuery()
      .setTopicId(this.topicId)
      .setStartTime(startTime)
      .subscribe(
        client,
        (msg, error) => {
          if (error) {
            console.error("Error receiving message:", error);
            subscription.unsubscribe();
            reject(error);
          }
        },
        (msg) => {
          const receivedMessage = Buffer.from(msg?.contents || '').toString('utf-8');
          console.log("Listener received message:", receivedMessage);
          if (receivedMessage === message) {
            received = true;
            subscription.unsubscribe();
            resolve();
          }
        }
      );
    });

    // Check if the message was received
    if (!received) {
      throw new Error(`Message not received from topic ${this.topicId}`);
    }
});

Given(/^A second account with more than (\d+) hbars$/, async function (expectedBalance: number) {
  const acc = accounts[4];
  const account: AccountId = AccountId.fromString(acc.id);
  this.secondAccount = account;
  const privKey: PrivateKey = PrivateKey.fromStringED25519(acc.privateKey);
  this.secondPrivKey = privKey;

  // Optionally, set the operator to the second account if you need to perform actions as this account
  client.setOperator(this.secondAccount, privKey);

  // Check balance
  const query = new AccountBalanceQuery().setAccountId(account);
  const balance = await query.execute(client);
  console.log(`Second account balance: ${balance.hbars.toString()}`);
  // assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance);
});

Given(/^A (\d+) of (\d+) threshold key with the first and second account$/, async function (threshold: string, total: string) {
  const thresholdNum = parseInt(threshold, 10);
  const totalNum = parseInt(total, 10);

  // Collect public keys from the first and second accounts
  const publicKeys = [
    this.privKey.publicKey,
    this.secondPrivKey.publicKey
  ];

  // Create the threshold key
  const thresholdKey = new KeyList(publicKeys, thresholdNum);

  // Store for use in topic creation
  this.thresholdKey = thresholdKey;
  console.log(`Created ${thresholdNum} of ${totalNum} threshold key with first and second account`);
});

When(/^A topic is created with the memo "([^"]*)" with the threshold key as the submit key$/, async function (memo: string) {
  if (!this.thresholdKey) {
    throw new Error("Threshold key not set. Make sure to run the threshold key step first.");
  }

  // Create the topic with the threshold key as the submit key
  const transaction = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(this.thresholdKey)
    .execute(client);

  const receipt = await transaction.getReceipt(client);
  const topicId = receipt.topicId;

  // Store the topic ID for later steps
  this.topicId = topicId;
  console.log(`Topic created with threshold key as submit key. Topic ID: ${topicId}`);

  await new Promise(resolve => setTimeout(resolve, 2000));
});
