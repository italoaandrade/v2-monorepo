import React from 'react'
import { Table } from '../Table'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { useEvents } from '../../hooks/useEvents'

export function MessageRevertedEvents () {
  const eventName = 'MessageReverted'
  const { events, nextPage, previousPage, showNextButton, showPreviousButton, limit } = useEvents(eventName)

  const headers = [
    {
      key: 'timestamp',
      value: 'Timestamp',
    },
    {
      key: 'messageId',
      value: 'Message ID',
    },
    {
      key: 'fromChainId',
      value: 'From Chain ID',
    },
    {
      key: 'from',
      value: 'From',
    },
    {
      key: 'to',
      value: 'To',
    },
    {
      key: 'eventChainId',
      value: 'Event Chain ID',
    },
  ]

  const rows = events.map((event: any) => {
    return [
      {
        key: 'timestamp',
        value: `${event.context.blockTimestamp} (${event.context.blockTimestampRelative})`
      },
      {
        key: 'messageId',
        value: event.messageIdTruncated
      },
      {
        key: 'fromChainId',
        value: event.fromChainId
      },
      {
        key: 'from',
        value: event.from
      },
      {
        key: 'To',
        value: event.to
      },
      {
        key: 'eventChainId',
        value: event.context.chainId
      },
    ]
  })

  return (
    <Box>
      <Table title={`${eventName} Events`} headers={headers} rows={rows} showNextButton={showNextButton} showPreviousButton={showPreviousButton} nextPage={nextPage} previousPage={previousPage} limit={limit} />
    </Box>
  )
}
