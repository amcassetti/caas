import RenJS from "@renproject/ren";
import adapterABI from './exchangeAdapterSimpleABI.json'
import streamAdapterABI from './streamAdapterSimpleABI.json'
import BigNumber from 'bignumber.js'

export const API_URL = ''
// export const API_URL = 'http://localhost:3000'
export const MIN_CLAIM_AMOUNT = 0.00011
let swapMonitor = null


export const addTx = (store, tx) => {
    const storeString = tx.type === 'swap' ? 'swap.transactions' : 'stream.transactions'
    let txs = store.get(storeString)
    txs.push(tx)
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))
    // for debugging
    window[storeString] = txs
}

export const updateTx = (store, newTx) => {
    const storeString = newTx.type === 'swap' ? 'swap.transactions' : 'stream.transactions'
    const txs = store.get(storeString).map(t => {
        if (t.id === newTx.id) {
            // const newTx = Object.assign(t, props)
            return newTx
        }
        return t
    })
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))

    // for debugging
    window[storeString] = txs
}

export const removeTx = (store, tx) => {
    const storeString = tx.type === 'swap' ? 'swap.transactions' : 'stream.transactions'
    let txs = store.get(storeString).filter(t => (t.id !== tx.id))
    // console.log(txs)
    store.set(storeString, txs)
    localStorage.setItem(storeString, JSON.stringify(txs))

    // for debugging
    window[storeString] = txs
}

export const streamExists = function(streams, beneficiary, startTime) {
    return streams.filter(stream => {
        console.log(stream, beneficiary, startTime)
        if (stream.destAddress === beneficiary && stream.startTime === startTime)  {
            return false
        } else {
            return true
        }
    }).length > 0
}

export const getStreams = async function() {
    // console.log('search', destAddress)
    const { store }  = this.props
    const web3 = store.get('web3')
    console.log(store.getState())
    // const web3Context = store.get('web3Context')
    const adapterAddress = store.get('stream.adapterAddress')
    const adapterContract = new web3.eth.Contract(streamAdapterABI, adapterAddress)
    // console.log(adapterContract)
    window.adapter = adapterContract
    const schedules = await adapterContract.methods.getSchedules().call()
    // console.log(schedules)
    return schedules
}

export const recoverStreams = async function(destAddress) {
    const { store } = this.props
    const web3 = store.get('web3')
    const schedules = await getStreams.bind(this)()
    const beneficiary = web3.utils.fromAscii(destAddress)
    const transactions = store.get('stream.transactions')
    // const alreadyExists = !streamExists(transactions, web3.utils.toAscii(s.beneficiary), Number(s.startTime))

    schedules.map(s => {
        // console.log(s.beneficiary)
        if (s.beneficiary === beneficiary) {
            const amount = new BigNumber(s.amount)
            const tx = {
                id: 'tx-' + Math.random().toFixed(6),
                type: 'stream',
                instant: false,
                awaiting: '',
                source: 'btc',
                dest: 'eth',
                destAddress,
                amount: amount.div(10 ** 8).toNumber(),
                startTime: s.startTime,
                duration: s.duration,
                error: false,
                txHash: '',
                schedule: s,
                claimTransactions: []
            }

            addTx(store, tx)
        } else {
            // show no results ui
        }
    })
}

export const calculateStreamProgress = function(tx) {
    const schedule = tx.schedule
    let totalClaimablePercentrage = 0
    let amountClaimedPercentage = 0

    if (schedule) {
        const start = Number(schedule.startTime)
        const now = Math.floor(Date.now() / 1000)
        const end = Number(schedule.startTime) + (Number(schedule.duration * 60))
        const period = end - start
        if (now > end) {
            totalClaimablePercentrage = 100
        } else {
            totalClaimablePercentrage = Number((((now - start) / period) * 100).toFixed(1))
        }
        amountClaimedPercentage = Number(((schedule.amountClaimed / schedule.amount) * 100).toFixed(1))
    }

    return {
        totalClaimablePercentrage,
        amountClaimedPercentage
    }
}

// make this better
export const updateStreamInfo = async function(tx) {
    const { store } =  this.props
    const web3 = store.get('web3')
    const { startTime, destAddress } = tx

    const beneficiary = web3.utils.fromAscii(destAddress)
    const schedules = await getStreams.bind(this)()

    const schedule = schedules.filter(s => (
        Number(s.startTime) === Number(startTime) &&
        s.beneficiary === beneficiary
    ))[0]

    if (schedule && schedule.beneficiary) {
        // console.log('updateStreamInfo', schedules, schedule)
        const sched = {
            id: schedule.id,
            beneficiary: schedule.beneficiary,
            startTime: schedule.startTime,
            duration: schedule.duration,
            amount: schedule.amount,
            amountClaimed: schedule.amountClaimed,
            minutesClaimed: schedule.minutesClaimed
        }
        let newTx = Object.assign(tx, {})
        newTx.schedule = sched
        updateTx(store, newTx)
    }
}

export const claim = async function(tx) {
    const { store }  = this.props
    const web3 = store.get('web3')
    const web3Context = store.get('web3Context')

    const adapterAddress = store.get('stream.adapterAddress')
    const { destAddress, schedule } = tx

    store.set('stream.claimRequesting', true)

    const {
        totalClaimablePercentrage,
        amountClaimedPercentage
    } = calculateStreamProgress(tx)

    const claimAmount = (((totalClaimablePercentrage - amountClaimedPercentage) / 100) * tx.amount).toFixed(6)

    const adapterContract = new web3.eth.Contract(streamAdapterABI, adapterAddress)
    const gasPrice = await web3Context.lib.eth.getGasPrice()

    // console.log('claiming tx', tx, schedule, schedule.id)

    try {
        const result = await adapterContract.methods.claim(
            schedule.id
        ).send({
            from: web3Context.accounts[0],
            gasPrice: Math.round(gasPrice * 1.5),
            gasLimit: 150000
        }).on('transactionHash', (hash) => {
            updateTx(store, Object.assign(tx, {
                claimTransactions: tx.claimTransactions.concat([{
                    timestamp: Date.now(),
                    amount: claimAmount,
                    txHash: hash
                }])
            }))
        }).on('confirmation', (confirmationNumber, receipt) => {
            if (confirmationNumber === 3) {
                store.set('stream.claimRequesting', false)
            }
            console.log('confirmation', confirmationNumber, receipt)
            updateStreamInfo.bind(this)(tx)
        })
        // console.log('result', result)
    } catch(e) {
        console.log(e)
        store.set('stream.claimRequesting', false)
    }
}

export const completeDeposit = async function(tx) {
    const { store }  = this.props
    const web3 = store.get('web3')
    const web3Context = store.get('web3Context')

    // const adapterAddress = store.get('adapterAddress')
    const { type, params, awaiting, renResponse, renSignature } = tx

    let adapterContract
    if (type === 'swap') {
        adapterContract = new web3.eth.Contract(adapterABI, store.get('swap.adapterAddress'))
    } else if (type === 'stream') {
        adapterContract = new web3.eth.Contract(streamAdapterABI, store.get('stream.adapterAddress'))
    }

    const gasPrice = await web3Context.lib.eth.getGasPrice()

    updateTx(store, Object.assign(tx, { awaiting: 'eth-settle' }))

    // console.log('completeDeposit', tx)

    try {
        let result
        if (type === 'swap') {
            result = await adapterContract.methods.shiftInWithSwap(
                params.contractCalls[0].contractParams[0].value,
                params.sendAmount,
                renResponse.autogen.nhash,
                renSignature
            ).send({
                from: web3Context.accounts[0],
                gasPrice: Math.round(gasPrice * 1.5),
                gasLimit: 200000
            })
        } else if (type === 'stream') {
            result = await adapterContract.methods.addVestingSchedule(
                params.contractCalls[0].contractParams[0].value,
                params.contractCalls[0].contractParams[1].value,
                Number(params.contractCalls[0].contractParams[2].value),
                params.sendAmount,
                renResponse.autogen.nhash,
                renSignature
            ).send({
                from: web3Context.accounts[0],
                gasPrice: Math.round(gasPrice * 1.5),
                gasLimit: 350000
            })
            await updateStreamInfo.bind(this)(tx)
        }
        updateTx(store, Object.assign(tx, { awaiting: '', txHash: result.transactionHash }))
    } catch(e) {
        // console.log(e)
        updateTx(store, Object.assign(tx, { error: true }))
    }
}

export const initShiftIn = function(tx) {
    const {
      type,
      amount,
      renBtcAddress,
      params,
      ethSig,
      destAddress,
      // stream
      startTime,
      duration
    } = tx
    const {
        sdk,
        web3
    } = this.props.store.getState()

    let adapterAddress = ''
    let contractFn = ''
    let contractParams = []

    if (type === 'swap') {
        adapterAddress = this.props.store.get('swap.adapterAddress')
        contractFn = 'shiftInWithSwap'
        contractParams = [
            {
                name: "_to",
                type: "address",
                value: destAddress
            }
        ]
    } else if (type === 'stream') {
        adapterAddress = this.props.store.get('stream.adapterAddress')
        contractFn = 'addVestingSchedule'
        contractParams = [
            {
                name: "_beneficiary",
                type: "bytes",
                value: web3.utils.fromAscii(destAddress),
            },
            {
                name: "_startTime",
                type: "uint256",
                value: startTime,
            },
            {
                name: "_duration",
                type: "uint16",
                value: duration,
            }
        ]
    }

    // // store data or update params with nonce
    const data = {
        sendToken: RenJS.Tokens.BTC.Btc2Eth,
        sendAmount: RenJS.utils.value(amount, "btc").sats(), // Convert to Satoshis
        sendTo: adapterAddress,
        contractFn,
        contractParams,
        nonce: params && params.nonce ? params.nonce : RenJS.utils.randomNonce(),
    }

    const shiftIn = sdk.shiftIn(data)

    window.shiftIns.push(shiftIn)

    return shiftIn
}

export const initDeposit = async function(tx) {
    const { store }  = this.props
    const {
        params,
        awaiting,
        renResponse,
        renSignature,
        error,
        btcConfirmations
    } = tx

    // console.log('initDeposit', tx)

    console.log('initDeposit', tx)

    // completed
    if (!awaiting) return

    // clear error when re-attempting
    if (error) {
        updateTx(store, Object.assign(tx, { error: false }))
    }

    // ren already exposed a signature
    if (renResponse && renSignature) {
        completeDeposit.bind(this)(tx)
    } else {
        // create or re-create shift in
        const shiftIn = await initShiftIn.bind(this)(tx)

        // console.log('initDeposit shiftin', shiftIn)

        if (!params) {
            addTx(store, Object.assign(tx, {
                params: shiftIn.params,
                renBtcAddress: shiftIn.addr()
            }))
        }

        // wait for btc
        const deposit = await shiftIn
            .waitForDeposit(2)
            .on("deposit", dep => {
                // console.log('on deposit', dep)
                if (dep.utxo) {
                    if (awaiting === 'btc-init') {
                        updateTx(store, Object.assign(tx, {
                            awaiting: 'btc-settle',
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txid
                        }))
                    } else {
                        updateTx(store, Object.assign(tx, {
                            btcConfirmations: dep.utxo.confirmations,
                            btcTxHash: dep.utxo.txid
                        }))
                    }
                }
            })

        updateTx(store, Object.assign(tx, { awaiting: 'ren-settle' }))

        try {
            const signature = await deposit.submitToRenVM();
            updateTx(store, Object.assign(tx, {
                renResponse: signature.response,
                renSignature: signature.signature
            }))

            completeDeposit.bind(this)(tx)
        } catch(e) {
            console.log(e)
        }
    }
}

export const initInstantSwap = async function(tx) {
    const { store }  = this.props
    const { params, awaiting, renResponse, renSignature, error } = tx

    const address = store.get('swap.address')
    const amount = store.get('swap.amount')

    const request = await fetch(`${API_URL}/swap-gateway/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sourceAmount: amount,
            sourceAsset: 'BTC',
            destinationAsset: 'ETH',
            destinationAddress: address
        })
    })
    const data = await request.json()
    addTx(store, Object.assign(tx, {
        renBtcAddress: data.gatewayAddress
    }))
}

export const initInstantMonitoring = function() {
    console.log('initInstantMonitoring before', this.props.store.get('transactions'))
    swapMonitor = setInterval(async () => {
        const transactions = this.props.store.get('swap.transactions')
        transactions.filter((t) => (t.instant && t.awaiting === 'btc-init')).map(async tx => {
            const req = await fetch(`${API_URL}/swap-gateway/status?gateway=${tx.renBtcAddress}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
            })

            const data = await req.json()
            if (data.status === 'complete') {
                updateTx(this.props.store, Object.assign(tx, {
                    awaiting: '',
                    txHash: data.txHash
                }))
            }
        })
    }, 1000)
}

export const initMonitoring = function() {
    const store = this.props.store

    const txs = store.get('swap.transactions').concat(store.get('stream.transactions'))
    // console.log('initMonitoring', txs)
    txs.map(tx => {
        if (tx.awaiting && !tx.instant) {
            initDeposit.bind(this)(tx)
        } else if (tx.type === 'stream') {
            updateStreamInfo.bind(this)(tx)
        }
    })
}

window.shiftIns = []

export default {
    addTx,
    updateTx,
    removeTx,
    completeDeposit,
    initShiftIn,
    initDeposit,
    initMonitoring
}
