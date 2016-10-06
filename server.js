'use strict'

const express = require('express')
const { Server } = require('http')
const mongoose = require('mongoose')
const socketio = require('socket.io')

const app = express()
const server = Server(app)
const io = socketio(server)

const PORT = process.env.PORT || 3000
const MONGODB_URL =  process.env.MONGODB_URL || 'mongodb://localhost:27017/tickietackietoe'

app.set('view engine', 'pug')

app.use(express.static('public'))

app.get('/', (req, res) =>
  Game.find()
  .or([{ player1: { $exists: false } }, { player2: { $exists: false } }])
  .exists('result', false)
  .then(games => res.render('home', { games }))
)

app.get('/game/create', (req, res) =>
  Game.create({}).then(game => res.redirect(`/game/${game._id}`))
)

app.get('/game/:id', (req, res) => {
  res.render('game')
})

mongoose.Promise = Promise
mongoose.connect(MONGODB_URL, () => {
  server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
})

const Game = mongoose.model('game', {
  board: {
    type: [
      [String, String, String],
      [String, String, String],
      [String, String, String],
    ],
    default: [
      ['','',''],
      ['','',''],
      ['','',''],
    ],
  },
  result: String,
  toMove: String,
  player1: String,
  player2: String,
})

io.on('connect', socket => {
  const id = socket.handshake.headers.referer.split('/').slice(-1)[0]

  Game.findById(id)
  .then(g => attemptToJoinGameAsPlayer(g, socket))
  .then(g => g.save())
  .then(g => {
    socket.join(g._id)
    socket.gameId = g._id
    io.to(g._id).emit('player joined', g)
  })
  .catch(err => {
    socket.emit('error', err)
    console.error(err)
  })

  console.log(`Socket connected: ${socket.id}`)

  socket.on('make move', move => makeMove(move, socket))
  socket.on('disconnect', () => handleDisconnect(socket))
})

const handleDisconnect = socket => {
  Game
    .findById(socket.gameId)
    .then(game => {
      if (!game.result && (socket.id === game.player1 || socket.id === game.player2)) {
        console.log('yes')
        game.toMove = undefined
        game.result = 'Disconnect'
      }
      return game.save()
    })
    .then(g => io.to(g._id).emit('player disconnected', g))
    .catch(console.error)
}

const makeMove = (move, socket) => {
  Game.findById(socket.gameId)
    .then(game => {
      if (isFinished(game) || !isSpaceAvailable(game, move) || !isPlayersTurn(game, socket)) {
        return Promise.reject('Cannot move')
      }
      return game
    })
    .then(g => setMove(g, move))
    .then(toggleNextMove)
    .then(setResult)
    .then(g => g.save())
    .then(g => io.to(g._id).emit('move made', g))
    .catch(console.error)
}

const attemptToJoinGameAsPlayer = (game, socket) => {
  if (hasTwoPlayers(game)) {
    return game
  }

  const playerNumber = randomPlayerNumber()

  if (hasZeroPlayers(game)) {
    game[`player${playerNumber}`] = socket.id
  } else if (game.player1 && !game.player2) {
    // player1 already connected and player2 is available
    game.player2 = socket.id
  } else if (!game.player1 && game.player2) {
    // player2 already connected and player1 is available
    game.player1 = socket.id
  }

  if (playerNumber === 1) {
    game.toMove = socket.id
  }

  return game
}
const nextMoveToken = game => game.toMove === game.player1 ? 'X' : 'O'
const isPlayersTurn = (game, socket) => game.toMove === socket.id
const randomPlayerNumber = () => Math.round(Math.random()) + 1
const hasZeroPlayers = game => !game.player1 && !game.player2
const hasTwoPlayers = game => !!(game.player1 && game.player2)
const isFinished = game => !!game.result
const isSpaceAvailable = (game, move) => !game.board[move.row][move.col]
const setMove = (game, move) => {
  game.board[move.row][move.col] = nextMoveToken(game)
  game.markModified('board') // trigger mongoose change detection
  return game
}
const toggleNextMove = game => {
  game.toMove = game.toMove === game.player1 ? game.player2 : game.player1
  return game
}
const setResult = game => {
  const result = winner(game.board)

  if (result) {
    game.toMove = undefined // mongoose equivalent to: `delete socket.game.toMove`
    game.result = result
  }

  return game
}

const winner = b => {
  // Rows
  if (b[0][0] && b[0][0] === b[0][1] && b[0][1] === b[0][2]) {
    return b[0][0]
  }

  if (b[1][0] && b[1][0] === b[1][1] && b[1][1] === b[1][2]) {
    return b[1][0]
  }

  if (b[2][0] && b[2][0] === b[2][1] && b[2][1] === b[2][2]) {
    return b[2][0]
  }

  // Cols
  if (b[0][0] && b[0][0] === b[1][0] && b[1][0] === b[2][0]) {
    return b[0][0]
  }

  if (b[0][1] && b[0][1] === b[1][1] && b[1][1] === b[2][1]) {
    return b[0][1]
  }

  if (b[0][2] && b[0][2] === b[1][2] && b[1][2] === b[2][2]) {
    return b[0][2]
  }

  // Diags
  if (b[0][0] && b[0][0] === b[1][1] && b[1][1] === b[2][2]) {
    return b[0][0]
  }

  if (b[0][2] && b[0][2] === b[1][1] && b[1][1] === b[2][0]) {
    return b[0][2]
  }

  // Tie
  if (!movesRemaining(b)) {
    return 'Tie'
  }

  // In-Progress
  return null
}

const movesRemaining = board => {
  const POSSIBLE_MOVES = 9
  const movesMade = flatten(board).join('').length

  return POSSIBLE_MOVES - movesMade
}

const flatten = array => array.reduce((a,b) => a.concat(b))
