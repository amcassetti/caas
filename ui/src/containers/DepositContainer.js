import React from 'react';
import { withStore } from '@spyna/react-store'
import { withStyles } from '@material-ui/styles';
import theme from '../theme/theme'
import classNames from 'classnames'
import Grid from '@material-ui/core/Grid';
import Divider from '@material-ui/core/Divider';
// import Tabs from '@material-ui/core/Tabs';
// import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import InputAdornment from '@material-ui/core/InputAdornment';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Switch from '@material-ui/core/Switch';

import BigNumber from "bignumber.js";
import RenJS from "@renproject/ren";

import {
    fromConnection,
    ephemeral
} from "@openzeppelin/network/lib";

import SwapTransactionStatus from '../components/SwapTransactionStatus'

import {
    initDeposit,
    initMonitoring,
    initInstantMonitoring,
    removeTx,
    updateTx,
    initInstantSwap
} from '../utils/txUtils'

const REACT_APP_TX_FEE = 100;
const signKey = ephemeral();
// const gasPrice = 10000000000;
const relay_client_config = {
  txfee: REACT_APP_TX_FEE,
  // force_gasPrice: gasPrice, //override requested gas price
  // gasPrice: gasPrice, //override requested gas price
  // force_gasLimit: 200000, //override requested gas limit.
  // gasLimit: 200000, //override requested gas limit.
  verbose: true
};



const styles = () => ({
  root: {
    flexGrow: 1,
  },
  paper: {
  },
  navContainer: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(3),
    minHeight: 52
  },
  contentContainer: {
      // boxShadow: '0px 0px 30px 0px rgba(0, 0, 0, 0.05)',
      borderRadius: theme.shape.borderRadius,
      border: '1px solid #7f7f7f',
      padding: theme.spacing(3),

      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(3),
      '& input': {
      }
  },
  input: {
      marginBottom: theme.spacing(2),
      width: '100%',
      '& input': {
          fontSize: 12
      },
      '& p': {
          fontSize: 12
      },
      '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(0, 0, 0, 0.5) !important'
      }
  },
  amountContainer: {
    paddingRight: theme.spacing(1)
  },
  amount: {
  },
  title: {
      fontSize: 16,
      fontWeight: 500,
      marginTop: theme.spacing(4)
  },
  unfinished: {
      // marginTop: theme.spacing(3)
  },
  depositItem: {
      fontSize: 12,
      marginBottom: theme.spacing(1)
  },
  depositStatus: {
      display: 'flex',
      justifyContent: 'space-between'
  },
  info: {
      fontSize: 12,
      marginBottom: theme.spacing(1),
      '& p': {
          marginBottom: 0
      }
  },
  divider: {
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(3),
      backgroundColor: '#999999'
  },
  desc: {
      marginBottom: theme.spacing(4),
      fontSize: 14,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between'
  },
  btcLink: {
      fontSize: 12
  },
  viewLink: {
      fontSize: 12,
      marginRight: theme.spacing(1),
  },
  actionTabs: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
  },
  swapButtonContainer: {
      textAlign: 'center',
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1)
  },
  switchContainer: {
      textAlign: 'center',
      paddingBottom: theme.spacing(1),
      '& .MuiFormControlLabel-label': {
          fontSize: 12
      }
  },
  swapButton: {
  }
})

class Ellipsis extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            string: ''
        }
        this.interval = null
    }

    componentDidMount() {
        this.interval = setInterval(() => {
            const string = this.state.string
            if (string.length < 3) {
                this.setState({ string: (string + '.') })
            } else {
                this.setState({ string: '' })
            }
        }, 500);
    }

    componentWillUnmount() {
        clearInterval(this.interval)
    }

    render() {
        return <span>{this.state.string}</span>
    }
}

class DepositContainer extends React.Component {

    constructor(props) {
        super(props);
    }

    async componentDidMount() {
    }

    componentWillUnmount() {
        clearInterval(this.swapMonitor)
    }

    async start() {
        const { store } = this.props
        const amount = store.get('swap.amount')
        const address = store.get('swap.address')
        const transactions = store.get('swap.transactions')

        const tx = {
            id: 'tx-' + Math.floor(Math.random() * (10 ** 16)),
            type: 'swap',
            instant: false,
            awaiting: 'btc-init',
            destAddress: address,
            amount: amount,
            error: false,
            txHash: ''
        }

        initDeposit.bind(this)(tx)
    }

    async startInstant() {
        const { store } = this.props
        const amount = store.get('swap.amount')
        const address = store.get('swap.address')
        const transactions = store.get('swap.transactions')

        const tx = {
            id: 'tx-' + Math.floor(Math.random() * (10 ** 16)),
            type: 'swap',
            instant: true,
            awaiting: 'btc-init',
            destAddress: address,
            amount: amount,
            error: false,
            txHash: ''
        }

        initInstantSwap.bind(this)(tx)
    }

    render() {
        const {
            classes,
            store
        } = this.props

        const adapterAddress = store.get('swap.adapterAddress')
        const instantSwapSelected = store.get('swap.instantSwapSelected')
        const transactions = store.get('swap.transactions')
        const amount = store.get('swap.amount')
        const address = store.get('swap.address')

        console.log(store.getState())

        const disabled = amount <= 0.0001 || (amount > 0.0005 && instantSwapSelected) || !address

        return <Grid container>
            {/*<Typography variant={'h1'} className={classes.title}>Kovan ETH – Testnet BTC Exchange</Typography>*/}

            <Grid item xs={12} className={classes.contentContainer}>
                <Grid container direction='row'>
                    <Grid className={classes.desc} item xs={12}>
                        <span >Swap BTC for ETH</span>
                        {/*<span className={classes.btcLink}>Send testnet BTC from <a target='_blank' href={'https://tbtc.bitaps.com/'}>here</a></span>*/}
                    </Grid>
                    <Grid item xs={12}>
                        <Grid container>
                            <Grid item xs={4} className={classes.amountContainer}>
                                <TextField className={classNames(classes.input, classes.amount)}
                                    variant='outlined'
                                    size='small'
                                    placeholder='0.000000'
                                    onChange={e => {
                                        store.set('swap.amount', e.target.value)
                                    }}
                                    InputProps={{
                                        endAdornment: <InputAdornment className={classes.endAdornment} position="end">BTC</InputAdornment>
                                    }}/>
                            </Grid>
                            <Grid item xs={8}>
                                <TextField className={classNames(classes.input, classes.address)} variant='outlined' size='small' placeholder='Send to ETH Address' onChange={e => {
                                    store.set('swap.address', e.target.value)
                                }}/>
                            </Grid>
                        </Grid>

                    </Grid>
                    <Grid item xs={12} className={classes.switchContainer}>
                        <FormControlLabel control={<Switch checked={instantSwapSelected}
                            color='primary'
                            onChange={() => store.set('swap.instantSwapSelected', !instantSwapSelected)}
                            value={"instant"} />} label="Faster swap (0 confirmations, 0.0005 BTC max)" />
                    </Grid>
                    <Grid item xs={12} className={classes.swapButtonContainer}>
                        <Button disabled={disabled} className={classes.swapButton} variant='outlined' color='primary' onClick={instantSwapSelected ? this.startInstant.bind(this) : this.start.bind(this)}>Start Swap</Button>
                    </Grid>
                    {transactions && transactions.length ? <Grid item xs={12}><Divider className={classes.divider} /></Grid> : null}
                    <Grid item xs={12} className={classes.unfinished}>
                        {transactions && transactions.length ? transactions.map((tx, index) => {
                            return <Grid key={index} container direction='row' className={classes.depositItem}>
                                <Grid item xs={3}>
                                    {tx.amount} BTC
                                </Grid>
                                <Grid className={classes.depositStatus} item xs={9}>
                                    <SwapTransactionStatus tx={tx} />
                                    <div>
                                        {tx.awaiting === 'btc-settle' ? <a className={classes.viewLink} target='_blank' href={`https://live.blockcypher.com/btc-testnet/tx/${tx.btcTxHash}`}>View transaction</a> : null}
                                        {tx.awaiting === 'btc-init' || tx.error || !tx.awaiting ? <div>
                                            {tx.txHash ? <a className={classes.viewLink} target='_blank' href={'https://kovan.etherscan.io/tx/'+tx.txHash}>View transaction</a> : null}
                                            <a href='javascript:;' onClick={() => {
                                                removeTx(store, tx)
                                            }}>{!tx.awaiting ? 'Clear' : 'Cancel'}</a></div> : null}
                                    </div>
                                </Grid>
                            </Grid>
                        }) : null}
                    </Grid>
                </Grid>
            </Grid>

            {<Grid item xs={12} className={classes.info}>
                <p>
                    <b className={classes.caption}>How it Works</b>
                    <br/>
                    <br/>
                    This exchange uses <a target='_blank' href='https://renproject.io/'>RenVM</a>, <a target='_blank' href='https://uniswap.io/'>Uniswap</a>, and Open Zeppelin's <a target='_blank' href='https://gsn.openzeppelin.com/'>GSN</a> to facilitate trustless interoperabilty between Bitcoin and Ethereum. All swaps abstract ETH away from the user with the <b>GaaS pattern</b>, and faster swaps are faciliated using the <b>CaaS pattern</b>. To learn more, check out our interoperability tutorials below:
                </p>
                <p>
                    <ul>
                        <li><a target='_blank' href={'https://docs.renproject.io/developers/tutorials'}>GaaS Tutorial</a> | Gas-less transactions</li>
                        <li><a target='_blank' href={'https://docs.renproject.io/developers/tutorials'}>CaaS tutorial</a> | Faster swaps via expedited confirmations</li>
                    </ul>
                </p>
                <p>
                    Swaps are submitted to the following adapter address: <a target='_blank' href={'https://kovan.etherscan.io/address/'+adapterAddress}>{adapterAddress}</a>
                </p>
                <p>
                    To learn more about building interoperable applications like this with RenVM, check out our <a target='_blank' href='https://renproject.io/developers'>developer center</a> or the following links:
                    <ul>
                        <li><a target='_blank' href={'https://docs.renproject.io/developers/ren-sdk'}>Getting started with RenJS</a></li>
                        <li><a target='_blank' href={'https://docs.renproject.io/developers/gateway-js'}>Getting started with GatewayJS</a></li>
                        <li><a target='_blank' href={'https://github.com/renproject/ren/wiki'}>Github Spec</a></li>
                    </ul>
                </p>
                <p>

                </p>
            </Grid>}

        </Grid>
    }
}

export default withStyles(styles)(withStore(DepositContainer))
