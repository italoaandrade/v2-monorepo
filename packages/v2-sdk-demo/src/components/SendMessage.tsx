import React, { useState, useEffect } from 'react'
import { Signer, providers } from 'ethers'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import LoadingButton from '@mui/lab/LoadingButton'
import TextField from '@mui/material/TextField'
import Textarea from '@mui/material/TextareaAutosize'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import { Hop } from '@hop-protocol/v2-sdk'
import { Syntax } from './Syntax'
import { ChainSelect } from './ChainSelect'
import { useStyles } from './useStyles'
import { CopyToClipboard } from 'react-copy-to-clipboard'

type Props = {
  signer: Signer
  sdk: Hop
  onboard: any
}

export function SendMessage (props: Props) {
  const { signer, sdk, onboard } = props
  const styles = useStyles()
  const [copied, setCopied] = useState(false)
  const [fromChainId, setFromChainId] = useState(() => {
    try {
      const cached = localStorage.getItem('sendMessage:fromChainId')
      if (cached) {
        return cached
      }
    } catch (err: any) {}
    return '420'
  })
  const [toChainId, setToChainId] = useState(() => {
    try {
      const cached = localStorage.getItem('sendMessage:toChainId')
      if (cached) {
        return cached
      }
    } catch (err: any) {}
    return '5'
  })
  const [toAddress, setToAddress] = useState(() => {
    try {
      const cached = localStorage.getItem('sendMessage:toAddress')
      if (cached) {
        return cached
      }
    } catch (err: any) {}
    return ''
  })
  const [toCalldata, setToCalldata] = useState(() => {
    try {
      const cached = localStorage.getItem('sendMessage:toCalldata')
      if (cached) {
        return cached
      }
    } catch (err: any) {}
    return ''
  })
  const [txData, setTxData] = useState('')
  const [populateTxDataOnly, setPopulateTxDataOnly] = useState(true)
  const [txHash, setTxHash] = useState('')
  const [messageId, setMessageId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem('sendMessage:fromChainId', fromChainId)
    } catch (err: any) {
      console.error(err)
    }
  }, [fromChainId])

  useEffect(() => {
    try {
      localStorage.setItem('sendMessage:toChainId', toChainId)
    } catch (err: any) {
      console.error(err)
    }
  }, [toChainId])

  useEffect(() => {
    try {
      localStorage.setItem('sendMessage:toAddress', toAddress)
    } catch (err: any) {
      console.error(err)
    }
  }, [toAddress])

  useEffect(() => {
    try {
      localStorage.setItem('sendMessage:toCalldata', toCalldata)
    } catch (err: any) {
      console.error(err)
    }
  }, [toCalldata])

  async function getSendTxData() {
    const args = {
      fromChainId: Number(fromChainId),
      toChainId: Number(toChainId),
      toAddress,
      toCalldata
    }
    console.log('args', args)
    const txData = await sdk.getSendMessagePopulatedTx(args)
    return txData
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setError('')
      setTxData('')
      setTxHash('')
      setMessageId('')
      setLoading(true)
      const txData = await getSendTxData()
      setTxData(JSON.stringify(txData, null, 2))
      const fee = await sdk.getMessageFee({ fromChainId: Number(fromChainId), toChainId: Number(toChainId) })
      if (!populateTxDataOnly) {
        let _signer = signer
        if (!_signer) {
          const wallets = await onboard.connectWallet()
          const ethersProvider = new providers.Web3Provider(
            wallets[0].provider,
            'any'
          )
          _signer = ethersProvider.getSigner()
        }

        const success = await onboard.setChain({ chainId: Number(fromChainId) })
        if (success) {
          const tx = await _signer.sendTransaction({
            ...txData,
            value: fee
          })
          setTxHash(tx.hash)

          const receipt = await tx.wait()
          const { messageId } = await sdk.getMessageSentEventFromTransactionReceipt({ fromChainId: Number(fromChainId), receipt })
          setMessageId(messageId)
        }
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    }
    setLoading(false)
  }

  const code = `
${populateTxDataOnly ? `
import { Hop } from '@hop-protocol/v2-sdk'
`.trim() : `
import { Hop } from '@hop-protocol/v2-sdk'
import { ethers } from 'ethers'
`.trim()}

async function main() {
  const fromChainId = ${fromChainId || 'undefined'}
  const toChainId = ${toChainId || 'undefined'}
  const toAddress = "${toAddress}"
  const toCalldata = "${toCalldata}"

  const hop = new Hop('goerli')
  const txData = await hop.getSendMessagePopulatedTx({
    fromChainId,
    toChainId,
    toAddress,
    toCalldata
  })
  ${populateTxDataOnly ? (
  'console.log(txData)'
  ) : (
  `
  const fee = await hop.getMessageFee(fromChainId, toChainId)
  const provider = new ethers.providers.Web3Provider(
    window.ethereum
  )
  const signer = provider.getSigner()
  const tx = await signer.sendTransaction({
    ...txData,
    value: fee
  })
  console.log(tx)
  `.trim()
  )}
}

main().catch(console.error)
`.trim()

  function handleCopy () {
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 1000)
  }

  return (
    <Box>
      <Box mb={1}>
        <Typography variant="h5">Send Message</Typography>
      </Box>
      <Box mb={4}>
        <Typography variant="subtitle1">Send message to a destination chain</Typography>
      </Box>
      <Box width="100%" display="flex" justifyContent="space-between" className={styles.container}>
        <Box mr={4} className={styles.formContainer}>
          <Box>
            <form onSubmit={handleSubmit}>
              <Box mb={2}>
                <Box mb={1}>
                  <label>From Chain ID <small><em>(number)</em></small></label>
                </Box>
                {/*
                <TextField fullWidth placeholder="420" value={fromChainId} onChange={event => setFromChainId(event.target.value)} />
                */}
                <ChainSelect value={fromChainId} chains={['420', '5']} onChange={value => setFromChainId(value)} />
              </Box>
              <Box mb={2}>
                <Box mb={1}>
                  <label>To Chain ID <small><em>(number)</em></small></label>
                </Box>
                {/*<TextField fullWidth placeholder="5" value={toChainId} onChange={event => setToChainId(event.target.value)} />*/}
                <ChainSelect value={toChainId} chains={['420', '5']} onChange={value => setToChainId(value)} />
              </Box>
              <Box mb={2}>
                <Box mb={1}>
                  <label>To <small><em>(address)</em></small></label>
                </Box>
                <TextField fullWidth placeholder="0x" value={toAddress} onChange={event => setToAddress(event.target.value)} />
              </Box>
              <Box mb={2}>
                <Box mb={1}>
                  <label>Data <small><em>(hex string)</em></small></label>
                </Box>
                <Textarea minRows={5} placeholder="0x" value={toCalldata} onChange={event => setToCalldata(event.target.value)} style={{ width: '100%' }} />
              </Box>
              <Box mb={2}>
                <Box>
                  <Checkbox onChange={event => setPopulateTxDataOnly(event.target.checked)} checked={populateTxDataOnly} />
                  <label>Populate Tx Only</label>
                </Box>
              </Box>
              <Box mb={2} display="flex" justifyContent="center">
                <LoadingButton loading={loading} fullWidth type="submit" variant="contained" size="large">{populateTxDataOnly ? 'Get tx data' : 'Send'}</LoadingButton>
              </Box>
            </form>
          </Box>
          {!!error && (
            <Box mb={4} width="100%" style={{ wordBreak: 'break-word' }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          {!!txHash && (
            <Box mb={4}>
              <Alert severity="success">Tx hash: {txHash}</Alert>
            </Box>
          )}
          {!!messageId && (
            <Box mb={4}>
              <Alert severity="info">Message ID: {messageId}</Alert>
            </Box>
          )}
          {!!txData && (
            <Box>
              <Box mb={2}>
                <Typography variant="body1">Output</Typography>
              </Box>
              <pre style={{
                maxWidth: '500px',
                overflow: 'auto'
              }}>
                {txData}
              </pre>
              <CopyToClipboard text={txData}
                onCopy={handleCopy}>
                <Typography variant="body2" style={{ cursor: 'pointer' }}>
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </Typography>
              </CopyToClipboard>
            </Box>
          )}
        </Box>
        <Box width="100%">
          <Box mb={2}>
            <Typography variant="subtitle1">Code example</Typography>
          </Box>
          <Box>
            <Syntax code={code} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
