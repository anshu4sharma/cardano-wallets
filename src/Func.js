import React, { useState, useEffect } from "react";
import {
  Tab,
  Tabs,
  RadioGroup,
  Radio,
  FormGroup,
  InputGroup,
  NumericInput,
} from "@blueprintjs/core";
import "../node_modules/@blueprintjs/core/lib/css/blueprint.css";
import "../node_modules/@blueprintjs/icons/lib/css/blueprint-icons.css";
import "../node_modules/normalize.css/normalize.css";
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
const App = () => {
  const [selectedTabId, setSelectedTabId] = useState("1");
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);
  const [walletFound, setWalletFound] = useState(false);
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [walletName, setWalletName] = useState(undefined);
  const [walletAPIVersion, setWalletAPIVersion] = useState(undefined);
  const [wallets, setWallets] = useState([]);
  const [networkId, setNetworkId] = useState(undefined);
  const [Utxos, setUtxos] = useState(undefined);
  const [balance, setBalance] = useState(undefined);
  const [changeAddress, setChangeAddress] = useState(undefined);
  const [rewardAddress, setRewardAddress] = useState(undefined);
  const [usedAddress, setUsedAddress] = useState(undefined);
  const [txBody, setTxBody] = useState(undefined);
  const [txBodyCborHex_unsigned, setTxBodyCborHexUnsigned] = useState("");
  const [txBodyCborHex_signed, setTxBodyCborHexSigned] = useState("");
  const [submittedTxHash, setSubmittedTxHash] = useState("");
  const [addressBech32SendADA, setAddressBech32SendADA] = useState(
    "addr_test1qrt7j04dtk4hfjq036r2nfewt59q8zpa69ax88utyr6es2ar72l7vd6evxct69wcje5cs25ze4qeshejy828h30zkydsu4yrmm"
  );
  const [lovelaceToSend, setLovelaceToSend] = useState(3000000);
  const [protocolParams] = useState({
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
  });

  const [API, setAPI] = useState(undefined);
  const pollWallets = (count = 0) => {
    const wallets = [];
    for (const key in window.cardano) {
      if (window.cardano[key].enable && wallets.indexOf(key) === -1) {
        wallets.push(key);
      }
    }
    if (wallets.length === 0 && count < 3) {
      setTimeout(() => {
        pollWallets(count + 1);
      }, 1000);
      return;
    }
    setWallets(wallets);
    setWhichWalletSelected(wallets[0]);
    refreshData();
  };
  const handleWalletSelect = (event) => {
    const selectedWallet = event.target.value;
    setWhichWalletSelected(selectedWallet);
    refreshData();
  };

  const checkIfWalletFound = () => {
    const walletKey = whichWalletSelected;
    const walletFound = !!window?.cardano?.[walletKey];
    setWalletFound(walletFound);
    console.log(walletFound, "walletFoundIfFound");
    return walletFound;
  };

  const checkIfWalletEnabled = async () => {
    let walletEnabled = false;
    try {
      const walletName = whichWalletSelected;
      walletEnabled = await window.cardano[walletName].isEnabled();
    } catch (err) {
      console.log(err);
    }
    setWalletIsEnabled(walletEnabled);
    return walletEnabled;
  };

  const enableWallet = async () => {
    const walletKey = whichWalletSelected;
    try {
      const api = await window.cardano[walletKey].enable();
      setAPI(api);
    } catch (err) {
      console.log(err);
    }
    return checkIfWalletEnabled();
  };

  const getAPIVersion = () => {
    const walletKey = whichWalletSelected;
    const walletAPIVersion = window?.cardano?.[walletKey].apiVersion;
    setWalletAPIVersion(walletAPIVersion);
    return walletAPIVersion;
  };

  const getWalletName = () => {
    const walletKey = whichWalletSelected;
    const walletName = window?.cardano?.[walletKey].name;
    setWalletName(walletName);
    return walletName;
  };

  const getNetworkId = async () => {
    try {
      const networkId = await API.getNetworkId();
      setNetworkId(networkId);
    } catch (err) {
      console.log(err);
    }
  };

  const getUtxos = async () => {
    let Utxos = [];

    try {
      const rawUtxos = await API.getUtxos();

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
      setUtxos(Utxos);
    } catch (err) {
      console.log(err);
    }
  };
  const getBalance = async () => {
    try {
      const balanceCBORHex = await API.getBalance();
      const balance = Value.from_bytes(Buffer.from(balanceCBORHex, "hex"))
        .coin()
        .to_str();
      console.log(Number(balance / 10e5), "balance");
      setBalance(Number(balance / 10e5).toFixed(2));
    } catch (err) {
      console.log(err);
    }
  };

  const getChangeAddress = async () => {
    try {
      const raw = await API.getChangeAddress();
      const changeAddress = Address.from_bytes(
        Buffer.from(raw, "hex")
      ).to_bech32();
      setChangeAddress(changeAddress);
    } catch (err) {
      console.log(err);
    }
  };
  const getRewardAddresses = async () => {
    try {
      const raw = await API.getRewardAddresses();
      const rawFirst = raw[0];
      const rewardAddress = Address.from_bytes(
        Buffer.from(rawFirst, "hex")
      ).to_bech32();
      // console.log(rewardAddress)
      setRewardAddress(rewardAddress);
    } catch (err) {
      console.log(err);
    }
  };
  // previosly used address
  const getUsedAddresses = async () => {
    try {
      const raw = await API.getUsedAddresses();
      const rawFirst = raw[0];
      const usedAddress = Address.from_bytes(
        Buffer.from(rawFirst, "hex")
      ).to_bech32();
      setUsedAddress(usedAddress);
    } catch (err) {
      console.log(err);
    }
  };
  const refreshData = async () => {
    try {
      const walletFound = checkIfWalletFound();
      console.log(walletFound, "walletFound in refreshData");
      if (walletFound) {
        await getAPIVersion();
        await getWalletName();
        const walletEnabled = await enableWallet();
        if (walletEnabled) {
          await getNetworkId();
          await getUtxos();
          await getBalance();
          await getChangeAddress();
          await getRewardAddresses();
          await getUsedAddresses();
        } else {
          setUtxos(null);
          setBalance(null);
          setChangeAddress(null);
          setRewardAddress(null);
          setUsedAddress(null);
          setTxBody(null);
          setSubmittedTxHash("");
        }
      } else {
        setWalletIsEnabled(false);
        setUtxos(null);
        setBalance(null);
        setChangeAddress(null);
        setRewardAddress(null);
        setUsedAddress(null);
        setTxBody(null);
        setSubmittedTxHash("");
      }
    } catch (err) {
      console.log(err);
    }
  };

  const initTransactionBuilder = async () => {
    const txBuilder = TransactionBuilder.new(
      TransactionBuilderConfigBuilder.new()
        .fee_algo(
          LinearFee.new(
            BigNum.from_str(protocolParams.linearFee.minFeeA),
            BigNum.from_str(protocolParams.linearFee.minFeeB)
          )
        )
        .pool_deposit(BigNum.from_str(protocolParams.poolDeposit))
        .key_deposit(BigNum.from_str(protocolParams.keyDeposit))
        .coins_per_utxo_word(BigNum.from_str(protocolParams.coinsPerUtxoWord))
        .max_value_size(protocolParams.maxValSize)
        .max_tx_size(protocolParams.maxTxSize)
        .prefer_pure_change(true)
        .build()
    );
    return txBuilder;
  };
  const getTxUnspentOutputs = async () => {
    let txOutputs = TransactionUnspentOutputs.new();
    for (const utxo of Utxos) {
      txOutputs.add(utxo.TransactionUnspentOutput);
    }
    return txOutputs;
  };
  const buildSendADATransaction = async () => {
    const txBuilder = await initTransactionBuilder();
    const shelleyOutputAddress = Address.from_bech32(addressBech32SendADA);
    const shelleyChangeAddress = Address.from_bech32(changeAddress);
    txBuilder.add_output(
      TransactionOutput.new(
        shelleyOutputAddress,
        Value.new(BigNum.from_str(lovelaceToSend.toString()))
      )
    );
    const txUnspentOutputs = await getTxUnspentOutputs();
    txBuilder.add_inputs_from(txUnspentOutputs, 1);
    txBuilder.add_change_if_needed(shelleyChangeAddress);
    const txBody = txBuilder.build();
    const transactionWitnessSet = TransactionWitnessSet.new();
    const tx = Transaction.new(
      txBody,
      TransactionWitnessSet.from_bytes(transactionWitnessSet.to_bytes())
    );
    let txVkeyWitnesses = await API.signTx(
      Buffer.from(tx.to_bytes(), "utf8").toString("hex"),
      true
    );
    txVkeyWitnesses = TransactionWitnessSet.from_bytes(
      Buffer.from(txVkeyWitnesses, "hex")
    );
    transactionWitnessSet.set_vkeys(txVkeyWitnesses.vkeys());
    const signedTx = Transaction.new(tx.body(), transactionWitnessSet);
    const submittedTxHash = await API.submitTx(
      Buffer.from(signedTx.to_bytes(), "utf8").toString("hex")
    );
    console.log(submittedTxHash);
    setSubmittedTxHash(submittedTxHash);
  };

  useEffect(() => {
    pollWallets();
    refreshData();
  }, []);
  const handleTabId = (tabId) => {
    setSelectedTabId(tabId);
  };
  return (
    <div style={{ margin: "20px" }}>
      <h1>Boilerplate DApp connector to Wallet</h1>
      <div style={{ paddingTop: "10px" }}>
        <div style={{ marginBottom: 15 }}>Select wallet:</div>
        <RadioGroup
          onChange={handleWalletSelect}
          selectedValue={whichWalletSelected}
          inline={true}
          className="wallets-wrapper"
        >
          {wallets.map((key) => (
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

      <button style={{ padding: "20px" }} onClick={refreshData}>
        Refresh
      </button>

      <p style={{ paddingTop: "20px" }}>
        <span style={{ fontWeight: "bold" }}>Wallet Found: </span>
        {`${walletFound}`}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Wallet Connected: </span>
        {`${walletIsEnabled}`}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Wallet API version: </span>
        {walletAPIVersion}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Wallet name: </span>
        {walletName}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>
          Network Id (0 = testnet; 1 = mainnet):{" "}
        </span>
        {networkId}
      </p>
      <p style={{ paddingTop: "20px" }}>
        <span style={{ fontWeight: "bold" }}>
          UTXOs: (UTXO #txid = ADA amount + AssetAmount + policyId.AssetName +
          ...):{" "}
        </span>
        {Utxos?.map((x) => (
          <li
            style={{ fontSize: "10px" }}
            key={`${x.str}${x.multiAssetStr}`}
          >{`${x.str}${x.multiAssetStr}`}</li>
        ))}
      </p>
      <p style={{ paddingTop: "20px" }}>
        <span style={{ fontWeight: "bold" }}>Balance: </span>
        {balance}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Change Address: </span>
        {changeAddress}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Staking Address: </span>
        {rewardAddress}
      </p>
      <p>
        <span style={{ fontWeight: "bold" }}>Used Address: </span>
        {usedAddress}
      </p>
      <hr style={{ marginTop: "40px", marginBottom: "40px" }} />

      <Tabs
        id="TabsExample"
        vertical={true}
        onChange={handleTabId}
        selectedTabId={selectedTabId}
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
                    setAddressBech32SendADA(event.target.value)
                  }
                  value={addressBech32SendADA}
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
                  value={lovelaceToSend}
                  min={1000000}
                  stepSize={1000000}
                  majorStepSize={1000000}
                  onValueChange={(event) => setLovelaceToSend(event)}
                />
              </FormGroup>
              <button
                style={{ padding: "10px" }}
                onClick={buildSendADATransaction}
              >
                Run
              </button>
            </div>
          }
        />
        <Tabs.Expander />
      </Tabs>
      <hr style={{ marginTop: "40px", marginBottom: "40px" }} />
      <p>{`Submitted Tx Hash: ${submittedTxHash}`}</p>
      <p>{submittedTxHash ? "check your wallet !" : ""}</p>
    </div>
  );
};

export default App;
