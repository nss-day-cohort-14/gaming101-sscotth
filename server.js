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

app.get('/', (req, res) => res.render('index'))

mongoose.Promise = Promise
mongoose.connect(MONGODB_URL, () => {
  server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
})

const Game = mongoose.model('game', {
  board: [
    [String, String, String],
    [String, String, String],
    [String, String, String],
  ],
  toMove: String,
  result: String,
})

io.on('connect', socket => {
  Game.create({
    board: [['','',''],['','',''],['','','']],
    toMove: 'X',
  })
  .then(g => {
    socket.game = g
    socket.emit('new game', g)
  })
  .catch(err => {
    socket.emit('error', err)
    console.error(err)
  })

  console.log(`Socket connected: ${socket.id}`)

  socket.on('make move', move => makeMove(move, socket))
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`))
})

const makeMove = (move, socket) => {
    if (isFinished(socket.game) || !isSpaceAvailable(socket.game, move)) {
      return
    }

    Promise.resolve()
      .then(() => setMove(socket.game, move))
      .then(toggleNextMove)
      .then(setResult)
      .then(g => g.save())
      .then(g => socket.emit('move made', g))
}

const isFinished = game => !!game.result
const isSpaceAvailable = (game, move) => !game.board[move.row][move.col]
const setMove = (game, move) => {
  game.board[move.row][move.col] = game.toMove
  game.markModified('board') // trigger mongoose change detection
  return game
}
const toggleNextMove = game => {
  game.toMove = game.toMove === 'X' ? 'O' : 'X'
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
