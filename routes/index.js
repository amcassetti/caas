const RenJS = require("@renproject/ren");
const Web3 = require("web3");
const ethers = require('ethers');
const Tx = require('ethereumjs-tx').Transaction;
const { fromConnection } = require('@openzeppelin/network/lib')

const express = require('express');
const router = express.Router();

// const ren = new RenJS('chaosnet')
const ren = new RenJS('testnet')

const adapterAddress = process.env.ADAPTER_ADDRESS;
const adapterABI = require('../utils/exchangeAdapterSimpleABI.json')

const walletAddress = process.env.WALLET_ADDRESS;
const walletKey = new Buffer.from(process.env.WALLET_KEY, 'hex')

const url = 'https://kovan.infura.io/v3/7ae0954512994011a37062e1f805f619';

// for gas price
// const web3 = new Web3(url)

const REACT_APP_TX_FEE = 100;
const signKey = {
    privateKey: walletKey,
    address: walletAddress
};


let web3Context = null;

(async function() {
    // const gasPriceResult = await web3.eth.getGasPrice()
    // console.log(gasPriceResult)
    // const gasPrice = 10000000000;
    const relay_client_config = {
      txfee: REACT_APP_TX_FEE,
      // force_gasPrice: gasPrice, //override requested gas price
      // gasPrice: gasPrice, //override requested gas price
      force_gasLimit: 200000, //override requested gas limit.
      gasLimit: 200000, //override requested gas limit.
      verbose: true
    };
    web3Context = await fromConnection(
        "https://kovan.infura.io/v3/7be66f167c2e4a05981e2ffc4653dec2",
        {
            gsn: { signKey, ...relay_client_config }
        }
    )
    // console.log(gas)
})()

const gatewayStatusMap = {
    // address: {
    //     status: 'pending' | 'completed',
    //     txHash: '0x'
    // }
}

// Swap using contract funds
const swap = async function (amount, dest, gateway) {
    console.log('swap amount', amount, dest)

    const adapterContract = new web3Context.lib.eth.Contract(adapterABI, adapterAddress)
    const gasPrice = await web3Context.lib.eth.getGasPrice()

    try {
        const result = await adapterContract.methods.swap(
            amount,
            dest
        ).send({
            from: web3Context.accounts[0],
            gasPrice: Math.round(gasPrice * 1.5)
        })
        // console.log('result', result)
        gatewayStatusMap[gateway].status = 'complete'
        gatewayStatusMap[gateway].txHash = result.transactionHash
    } catch(e) {
        console.log(e)
    }
}

// Complete the shift once RenVM verifies the tx
const completeShiftIn = async function (shiftIn, signature, response) {
    console.log('completeShiftIn', signature, response)
    const params = shiftIn.params
    const msg = params.contractParams[0].value
    const amount = params.sendAmount
    const nHash = response.args.nhash
    const adapterContract = new web3Context.lib.eth.Contract(adapterABI, adapterAddress)
    const gasPrice = await web3Context.lib.eth.getGasPrice()

    try {
        const result = await adapterContract.methods.shiftIn(
            msg,
            amount,
            nHash,
            signature
        ).send({
            from: web3Context.accounts[0],
            gasPrice: Math.round(gasPrice * 1.5)
            // nonce: 15
        })
        console.log('shift in hash for ' + shiftIn.gatewayAddress, result.transactionHash)
    } catch(e) {
        console.log(e)
    }
}

// Stagger Swap and Shift-in based on tx confirmations
const monitorShiftIn = async function (shiftIn, dest) {
    const gateway = shiftIn.gatewayAddress
    const confsTillSwap = 0
    const confsTillShiftIn = 2

    console.log('awaiting initial tx', gateway, shiftIn.params.sendAmount)
    const initalConf = await shiftIn.waitForDeposit(confsTillSwap);
    console.log('calling swap', shiftIn.params.sendAmount, dest, gateway)
    swap(shiftIn.params.sendAmount, dest, gateway)

    console.log('awaiting final confs', gateway)
    const fullConf = await shiftIn.waitForDeposit(confsTillShiftIn);
    console.log('submitting to renvm', fullConf)
    const renvm = await fullConf.submitToRenVM()
    console.log('renvm response', renvm)
    completeShiftIn(shiftIn, renvm.signature, renvm.response)
}

// Routes
router.post('/swap-gateway/create', function(req, res, next) {
    const params = req.body
    const amount = params.sourceAmount
    const dest = params.destinationAddress

    const shiftIn = ren.shiftIn({
        sendToken: RenJS.Tokens.BTC.Btc2Eth,
        sendAmount: Math.floor(amount * (10 ** 8)), // Convert to Satoshis
        sendTo: adapterAddress,
        contractFn: "shiftIn",
        contractParams: [
            {
                name: "_msg",
                type: "bytes",
                value: web3Context.lib.utils.fromAscii(`Depositing ${amount} BTC`),
            }
        ],
    });
    const gatewayAddress = shiftIn.gatewayAddress
    gatewayStatusMap[gatewayAddress] = {
        status: 'pending',
        txHash: ''
    }

    monitorShiftIn(shiftIn, dest)
    res.json({ gatewayAddress })
});

router.get('/swap-gateway/status', function(req, res, next) {
    const id = req.query.gateway
    res.json(id && gatewayStatusMap[id] ? gatewayStatusMap[id] : {});
});

router.get('/', function(req, res, next) {
    res.render('../ui/build/index')
});

module.exports = router;
