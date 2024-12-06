// This is an adaption of the "official" example of how to use subscriptions with Apollo server
// https://github.com/apollographql/docs-examples/tree/main/apollo-server/v4/subscriptions-graphql-ws
import { ApolloServer } from '@apollo/server'
import { PubSub } from 'graphql-subscriptions'
import { createApp, defineWebSocketHandler } from 'h3'
import { startServerAndCreateH3Handler } from '../src'
import { defineGraphqlWebSocket } from '../src/websocket'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'

const pubsub = new PubSub()

// A number that we'll increment over time to simulate subscription events
let currentNumber = 0

// Schema definition
const typeDefs = `#graphql
  type Query {
    currentNumber: Int
  }

  type Subscription {
    numberIncremented: Int
  }
`

// Resolver map
const resolvers = {
  Query: {
    currentNumber() {
      return currentNumber
    },
  },
  Subscription: {
    numberIncremented: {
      subscribe: () => pubsub.asyncIterator(['NUMBER_INCREMENTED']),
    },
  },
}

// Create schema, which will be used separately by ApolloServer and
// the WebSocket server.
const schema = makeExecutableSchema({ typeDefs, resolvers })

// Create an h3 app; we will attach the WebSocket
// server and the ApolloServer to it.
export const app = createApp()

// Set up ApolloServer.
const apollo = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({
      // This is needed to be able to change the ws endpoint
      embed: { endpointIsEditable: true },
    }),
  ],
})

//app.use('/', startServerAndCreateH3Handler(apollo))
app.use(
  // TODO: For some reason it doesn't work with the root path
  // see discussion at https://github.com/unjs/h3/issues/719
  '/ws',
  startServerAndCreateH3Handler(apollo, {
    websocket: {
      ...await defineGraphqlWebSocket({ schema }),
      error(peer, error) {
        console.error('[ws] error', peer, error)
        // In a real app, you would want to properly log this error
      },
      // For debugging:
      // message(peer, message) {
      //   console.error('[ws] message', peer, message)
      // },
      // open(peer) {
      //   console.error('[ws] open', peer)
      // },
      // upgrade(req) {
      //   console.error('[ws] upgrade', req)
      // },
      // close(peer, details) {
      //   console.error('[ws] close', peer, details)
      // }
    },
  }),
)

// Alternatively, you can use the following to define only the WebSocket server without ApolloServer.
app.use(
  '/_ws',
  defineWebSocketHandler({
    ...await defineGraphqlWebSocket({ schema }),
    error(peer, error) {
      console.log('[ws] error', peer, error)
    },
  }),
)

// In the background, increment a number every second and notify subscribers when it changes.
function incrementNumber() {
  currentNumber++
  pubsub
    .publish('NUMBER_INCREMENTED', { numberIncremented: currentNumber })
    .catch(console.error)
  setTimeout(incrementNumber, 1000)
}

// Start incrementing
incrementNumber()
