import React from "react";
import {
  Tab,
  Tabs,
  RadioGroup,
  Radio,
  FormGroup,
  InputGroup,
  NumericInput,
} from "@blueprintjs/core";

import {
  Address,
  TransactionUnspentOutput,
  TransactionUnspentOutputs,
  TransactionOutput,
  Value,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  LinearFee,
  BigNum,
  TransactionWitnessSet,
  Transaction,
} from "@emurgo/cardano-serialization-lib-asmjs";
let Buffer = require("buffer/").Buffer;

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTabId: "1",
      whichWalletSelected: undefined,
      walletFound: false,
      walletIsEnabled: false,
      walletName: undefined,
      walletIcon: undefined,
      walletAPIVersion: undefined,
      wallets: [],
      networkId: undefined,
      Utxos: undefined,
      CollatUtxos: undefined,
      balance: undefined,
      changeAddress: undefined,
      rewardAddress: undefined,
      usedAddress: undefined,
      txBody: undefined,
      txBodyCborHex_unsigned: "",
      txBodyCborHex_signed: "",
      submittedTxHash: "",
      addressBech32SendADA:
        "addr_test1qrt7j04dtk4hfjq036r2nfewt59q8zpa69ax88utyr6es2ar72l7vd6evxct69wcje5cs25ze4qeshejy828h30zkydsu4yrmm",
      lovelaceToSend: 3000000,
      assetNameHex: "4c494645",
      assetPolicyIdHex:
        "ae02017105527c6c0c9840397a39cc5ca39fabe5b9998ba70fda5f2f",
      assetAmountToSend: 5,
      addressScriptBech32:
        "addr_test1wpnlxv2xv9a9ucvnvzqakwepzl9ltx7jzgm53av2e9ncv4sysemm8",
      datumStr: "12345678",
      plutusScriptCborHex: "4e4d01000033222220051200120011",
      transactionIdLocked: "",
      transactionIndxLocked: 0,
      lovelaceLocked: 3000000,
      manualFee: 900000,
    };

    /**
     * When the wallet is connect it returns the connector which is
     * written to this API variable and all the other operations
     * run using this API object
     */
    this.API = undefined;
    /**
     * Protocol parameters
     * @type {{
     * keyDeposit: string,
     * coinsPerUtxoWord: string,
     * minUtxo: string,
     * poolDeposit: string,
     * maxTxSize: number,
     * priceMem: number,
     * maxValSize: number,
     * linearFee: {minFeeB: string, minFeeA: string}, priceStep: number
     * }}
     */
    this.protocolParams = {
      linearFee: {
        minFeeA: "44",
        minFeeB: "155381",
      },
      minUtxo: "34482",
      poolDeposit: "500000000",
      keyDeposit: "2000000",
      maxValSize: 5000,
      maxTxSize: 16384,
      priceMem: 0.0577,
      priceStep: 0.0000721,
      coinsPerUtxoWord: "34482",
    };
    this.pollWallets = this.pollWallets.bind(this);
  }

  /**
   * Poll the wallets it can read from the browser.
   * Sometimes the html document loads before the browser initialized browser plugins (like Nami or Flint).
   * So we try to poll the wallets 3 times (with 1 second in between each try).
   *
   * Note: CCVault and Eternl are the same wallet, Eternl is a rebrand of CCVault
   * So both of these wallets as the Eternl injects itself twice to maintain
   * backward compatibility
   *
   * @param count The current try count.
   */
  pollWallets = (count = 0) => {
    const wallets = [];
    for (const key in window.cardano) {
      if (window.cardano[key].enable && wallets.indexOf(key) === -1) {
        wallets.push(key);
      }
    }
    if (wallets.length === 0 && count < 3) {
      setTimeout(() => {
        this.pollWallets(count + 1);
      }, 1000);
      return;
    }
    this.setState(
      {
        wallets,
        whichWalletSelected: wallets[0],
      },
      () => {
        this.refreshData();
      }
    );
  };

  /**
   * Handles the tab selection on the user form
   * @param tabId
   */
  handleTabId = (tabId) => this.setState({ selectedTabId: tabId });

  /**
   * Handles the radio buttons on the form that
   * let the user choose which wallet to work with
   * @param obj
   */
  handleWalletSelect = (obj) => {
    const whichWalletSelected = obj.target.value;
    this.setState({ whichWalletSelected }, () => {
      this.refreshData();
    });
  };

  /**
   * Checks if the wallet is running in the browser
   * Does this for Nami, Eternl and Flint wallets
   * @returns {boolean}
   */

  checkIfWalletFound = () => {
    const walletKey = this.state.whichWalletSelected;
    const walletFound = !!window?.cardano?.[walletKey];
    this.setState({ walletFound });
    return walletFound;
  };

  /**
   * Checks if a connection has been established with
   * the wallet
   * @returns {Promise<boolean>}
   */
  checkIfWalletEnabled = async () => {
    let walletIsEnabled = false;

    try {
      const walletName = this.state.whichWalletSelected;
      walletIsEnabled = await window.cardano[walletName].isEnabled();
    } catch (err) {
      console.log(err);
    }
    this.setState({ walletIsEnabled });

    return walletIsEnabled;
  };

  /**
   * Enables the wallet that was chosen by the user
   * When this executes the user should get a window pop-up
   * from the wallet asking to approve the connection
   * of this app to the wallet
   * @returns {Promise<boolean>}
   */

  enableWallet = async () => {
    const walletKey = this.state.whichWalletSelected;
    try {
      this.API = await window.cardano[walletKey].enable();
    } catch (err) {
      console.log(err);
    }
    return this.checkIfWalletEnabled();
  };

  /**
   * Get the API version used by the wallets
   * writes the value to state
   * @returns {*}
   */
  getAPIVersion = () => {
    const walletKey = this.state.whichWalletSelected;
    const walletAPIVersion = window?.cardano?.[walletKey].apiVersion;
    this.setState({ walletAPIVersion });
    return walletAPIVersion;
  };

  /**
   * Get the name of the wallet (nami, eternl, flint)
   * and store the name in the state
   * @returns {*}
   */

  getWalletName = () => {
    const walletKey = this.state.whichWalletSelected;
    const walletName = window?.cardano?.[walletKey].name;
    this.setState({ walletName });
    return walletName;
  };

  /**
   * Gets the Network ID to which the wallet is connected
   * 0 = testnet
   * 1 = mainnet
   * Then writes either 0 or 1 to state
   * @returns {Promise<void>}
   */
  getNetworkId = async () => {
    try {
      const networkId = await this.API.getNetworkId();
      this.setState({ networkId });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Gets the UTXOs from the user's wallet and then
   * stores in an object in the state
   * @returns {Promise<void>}
   */

  getUtxos = async () => {
    let Utxos = [];

    try {
      const rawUtxos = await this.API.getUtxos();

      for (const rawUtxo of rawUtxos) {
        const utxo = TransactionUnspentOutput.from_bytes(
          Buffer.from(rawUtxo, "hex")
        );
        const input = utxo.input();
        const txid = Buffer.from(
          input.transaction_id().to_bytes(),
          "utf8"
        ).toString("hex");
        const txindx = input.index();
        const output = utxo.output();
        const amount = output.amount().coin().to_str(); // ADA amount in lovelace
        const multiasset = output.amount().multiasset();
        let multiAssetStr = "";

        if (multiasset) {
          const keys = multiasset.keys(); // policy Ids of thee multiasset
          const N = keys.len();
          // console.log(`${N} Multiassets in the UTXO`)

          for (let i = 0; i < N; i++) {
            const policyId = keys.get(i);
            const policyIdHex = Buffer.from(
              policyId.to_bytes(),
              "utf8"
            ).toString("hex");
            // console.log(`policyId: ${policyIdHex}`)
            const assets = multiasset.get(policyId);
            const assetNames = assets.keys();
            const K = assetNames.len();
            // console.log(`${K} Assets in the Multiasset`)

            for (let j = 0; j < K; j++) {
              const assetName = assetNames.get(j);
              const assetNameString = Buffer.from(
                assetName.name(),
                "utf8"
              ).toString();
              const assetNameHex = Buffer.from(
                assetName.name(),
                "utf8"
              ).toString("hex");
              const multiassetAmt = multiasset.get_asset(policyId, assetName);
              multiAssetStr += `+ ${multiassetAmt.to_str()} + ${policyIdHex}.${assetNameHex} (${assetNameString})`;
              // console.log(assetNameString)
              // console.log(`Asset Name: ${assetNameHex}`)
            }
          }
        }

        const obj = {
          txid: txid,
          txindx: txindx,
          amount: amount,
          str: `${txid} #${txindx} = ${amount}`,
          multiAssetStr: multiAssetStr,
          TransactionUnspentOutput: utxo,
        };
        Utxos.push(obj);
        // console.log(`utxo: ${str}`)
      }
      this.setState({ Utxos });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Gets the current balance of in Lovelace in the user's wallet
   * This doesnt resturn the amounts of all other Tokens
   * For other tokens you need to look into the full UTXO list
   * @returns {Promise<void>}
   */
  getBalance = async () => {
    try {
      const balanceCBORHex = await this.API.getBalance();
      const balance = Value.from_bytes(Buffer.from(balanceCBORHex, "hex"))
        .coin()
        .to_str();
      console.log(Number(balance / 10e5), "balance");
      this.setState({ balance: Number(balance / 10e5).toFixed(2) });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Get the address from the wallet into which any spare UTXO should be sent
   * as change when building transactions.
   * @returns {Promise<void>}
   */
  getChangeAddress = async () => {
    try {
      const raw = await this.API.getChangeAddress();
      const changeAddress = Address.from_bytes(
        Buffer.from(raw, "hex")
      ).to_bech32();
      this.setState({ changeAddress });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * This is the Staking address into which rewards from staking get paid into
   * @returns {Promise<void>}
   */
  getRewardAddresses = async () => {
    try {
      const raw = await this.API.getRewardAddresses();
      const rawFirst = raw[0];
      const rewardAddress = Address.from_bytes(
        Buffer.from(rawFirst, "hex")
      ).to_bech32();
      // console.log(rewardAddress)
      this.setState({ rewardAddress });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Gets previsouly used addresses
   * @returns {Promise<void>}
   */
  getUsedAddresses = async () => {
    try {
      const raw = await this.API.getUsedAddresses();
      const rawFirst = raw[0];
      const usedAddress = Address.from_bytes(
        Buffer.from(rawFirst, "hex")
      ).to_bech32();
      // console.log(rewardAddress)
      this.setState({ usedAddress });
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Refresh all the data from the user's wallet
   * @returns {Promise<void>}
   */
  refreshData = async () => {
    try {
      const walletFound = this.checkIfWalletFound();
      if (walletFound) {
        await this.getAPIVersion();
        await this.getWalletName();
        const walletEnabled = await this.enableWallet();
        if (walletEnabled) {
          await this.getNetworkId();
          await this.getUtxos();
          await this.getBalance();
          await this.getChangeAddress();
          await this.getRewardAddresses();
          await this.getUsedAddresses();
        } else {
          await this.setState({
            Utxos: null,
            CollatUtxos: null,
            balance: null,
            changeAddress: null,
            rewardAddress: null,
            usedAddress: null,
            txBody: null,
            txBodyCborHex_unsigned: "",
            txBodyCborHex_signed: "",
            submittedTxHash: "",
          });
        }
      } else {
        await this.setState({
          walletIsEnabled: false,
          Utxos: null,
          CollatUtxos: null,
          balance: null,
          changeAddress: null,
          rewardAddress: null,
          usedAddress: null,
          txBody: null,
          txBodyCborHex_unsigned: "",
          txBodyCborHex_signed: "",
          submittedTxHash: "",
        });
      }
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * Every transaction starts with initializing the
   * TransactionBuilder and setting the protocol parameters
   * This is boilerplate
   * @returns {Promise<TransactionBuilder>}
   */
  initTransactionBuilder = async () => {
    const txBuilder = TransactionBuilder.new(
      TransactionBuilderConfigBuilder.new()
        .fee_algo(
          LinearFee.new(
            BigNum.from_str(this.protocolParams.linearFee.minFeeA),
            BigNum.from_str(this.protocolParams.linearFee.minFeeB)
          )
        )
        .pool_deposit(BigNum.from_str(this.protocolParams.poolDeposit))
        .key_deposit(BigNum.from_str(this.protocolParams.keyDeposit))
        .coins_per_utxo_word(
          BigNum.from_str(this.protocolParams.coinsPerUtxoWord)
        )
        .max_value_size(this.protocolParams.maxValSize)
        .max_tx_size(this.protocolParams.maxTxSize)
        .prefer_pure_change(true)
        .build()
    );

    return txBuilder;
  };

  /**
   * Builds an object with all the UTXOs from the user's wallet
   * @returns {Promise<TransactionUnspentOutputs>}
   */
  getTxUnspentOutputs = async () => {
    let txOutputs = TransactionUnspentOutputs.new();
    for (const utxo of this.state.Utxos) {
      txOutputs.add(utxo.TransactionUnspentOutput);
    }
    return txOutputs;
  };

  /**
   * The transaction is build in 3 stages:
   * 1 - initialize the Transaction Builder
   * 2 - Add inputs and outputs
   * 3 - Calculate the fee and how much change needs to be given
   * 4 - Build the transaction body
   * 5 - Sign it (at this point the user will be prompted for
   * a password in his wallet)
   * 6 - Send the transaction
   * @returns {Promise<void>}
   */
  buildSendADATransaction = async () => {
    const txBuilder = await this.initTransactionBuilder();
    const shelleyOutputAddress = Address.from_bech32(
      this.state.addressBech32SendADA
    );
    const shelleyChangeAddress = Address.from_bech32(this.state.changeAddress);

    txBuilder.add_output(
      TransactionOutput.new(
        shelleyOutputAddress,
        Value.new(BigNum.from_str(this.state.lovelaceToSend.toString()))
      )
    );

    // Find the available UTXOs in the wallet and
    // us them as Inputs
    const txUnspentOutputs = await this.getTxUnspentOutputs();
    txBuilder.add_inputs_from(txUnspentOutputs, 1);

    // calculate the min fee required and send any change to an address
    txBuilder.add_change_if_needed(shelleyChangeAddress);

    // once the transaction is ready, we build it to get the tx body without witnesses
    const txBody = txBuilder.build();

    // Tx witness
    const transactionWitnessSet = TransactionWitnessSet.new();

    const tx = Transaction.new(
      txBody,
      TransactionWitnessSet.from_bytes(transactionWitnessSet.to_bytes())
    );

    let txVkeyWitnesses = await this.API.signTx(
      Buffer.from(tx.to_bytes(), "utf8").toString("hex"),
      true
    );

    console.log(txVkeyWitnesses);

    txVkeyWitnesses = TransactionWitnessSet.from_bytes(
      Buffer.from(txVkeyWitnesses, "hex")
    );

    transactionWitnessSet.set_vkeys(txVkeyWitnesses.vkeys());

    const signedTx = Transaction.new(tx.body(), transactionWitnessSet);

    const submittedTxHash = await this.API.submitTx(
      Buffer.from(signedTx.to_bytes(), "utf8").toString("hex")
    );
    console.log(submittedTxHash);
    this.setState({ submittedTxHash });
  };
  async componentDidMount() {
    this.pollWallets();
    await this.refreshData();
  }

  render() {
    return (
      <div style={{ margin: "20px" }}>
        <h1>Boilerplate DApp connector to Wallet</h1>
        <div style={{ paddingTop: "10px" }}>
          <div style={{ marginBottom: 15 }}>Select wallet:</div>
          <RadioGroup
            onChange={this.handleWalletSelect}
            selectedValue={this.state.whichWalletSelected}
            inline={true}
            className="wallets-wrapper"
          >
            {this.state.wallets.map((key) => (
              <Radio key={key} className="wallet-label" value={key}>
                <img
                  src={window.cardano[key].icon}
                  width={24}
                  height={24}
                  alt={key}
                />
                {window.cardano[key].name} ({key})
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <button style={{ padding: "20px" }} onClick={this.refreshData}>
          Refresh
        </button>

        <p style={{ paddingTop: "20px" }}>
          <span style={{ fontWeight: "bold" }}>Wallet Found: </span>
          {`${this.state.walletFound}`}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Wallet Connected: </span>
          {`${this.state.walletIsEnabled}`}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Wallet API version: </span>
          {this.state.walletAPIVersion}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Wallet name: </span>
          {this.state.walletName}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>
            Network Id (0 = testnet; 1 = mainnet):{" "}
          </span>
          {this.state.networkId}
        </p>
        <p style={{ paddingTop: "20px" }}>
          <span style={{ fontWeight: "bold" }}>
            UTXOs: (UTXO #txid = ADA amount + AssetAmount + policyId.AssetName +
            ...):{" "}
          </span>
          {this.state.Utxos?.map((x) => (
            <li
              style={{ fontSize: "10px" }}
              key={`${x.str}${x.multiAssetStr}`}
            >{`${x.str}${x.multiAssetStr}`}</li>
          ))}
        </p>
        <p style={{ paddingTop: "20px" }}>
          <span style={{ fontWeight: "bold" }}>Balance: </span>
          {this.state.balance}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Change Address: </span>
          {this.state.changeAddress}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Staking Address: </span>
          {this.state.rewardAddress}
        </p>
        <p>
          <span style={{ fontWeight: "bold" }}>Used Address: </span>
          {this.state.usedAddress}
        </p>
        <hr style={{ marginTop: "40px", marginBottom: "40px" }} />

        <Tabs
          id="TabsExample"
          vertical={true}
          onChange={this.handleTabId}
          selectedTabId={this.state.selectedTabId}
        >
          <Tab
            id="1"
            title="1. Send ADA to Address"
            panel={
              <div style={{ marginLeft: "20px" }}>
                <FormGroup
                  helperText="insert an address where you want to send some ADA ..."
                  label="Address where to send ADA"
                >
                  <InputGroup
                    disabled={false}
                    leftIcon="id-number"
                    onChange={(event) =>
                      this.setState({
                        addressBech32SendADA: event.target.value,
                      })
                    }
                    value={this.state.addressBech32SendADA}
                  />
                </FormGroup>
                <FormGroup
                  helperText="Adjust Order Amount ..."
                  label="Lovelaces (1 000 000 lovelaces = 1 ADA)"
                  labelFor="order-amount-input2"
                >
                  <NumericInput
                    id="order-amount-input2"
                    disabled={false}
                    leftIcon={"variable"}
                    allowNumericCharactersOnly={true}
                    value={this.state.lovelaceToSend}
                    min={1000000}
                    stepSize={1000000}
                    majorStepSize={1000000}
                    onValueChange={(event) =>
                      this.setState({ lovelaceToSend: event })
                    }
                  />
                </FormGroup>
                <button
                  style={{ padding: "10px" }}
                  onClick={this.buildSendADATransaction}
                >
                  Run
                </button>
              </div>
            }
          />
          <Tabs.Expander />
        </Tabs>
        <hr style={{ marginTop: "40px", marginBottom: "40px" }} />
        <p>{`Submitted Tx Hash: ${this.state.submittedTxHash}`}</p>
        <p>{this.state.submittedTxHash ? "check your wallet !" : ""}</p>
      </div>
    );
  }
}
