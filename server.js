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
  player1: String,
  player2: String,
  nextTurn: String,
  result: String,
})

io.on('connect', socket => {
  matchNewSocketToGame(socket)
  socket.on('make move', () => handleMove(move, socket))
  socket.on('disconnect', () => handleDisconnect(socket))
})

// ----- MATCHMAKING LOGIC -----

function matchNewSocketToGame (socket) {
  Game.findOne().sort('-_id').then(game => {
    // if there are no games in the database or the last one already has two players, start a new game
    if (!game || hasTwoPlayers(game)) {
      return Game.create({
        board: [['','',''],['','',''],['','','']],
        [`player${randomPlayer1or2()}`]: socket.id,
      })
    }

    // otherwise add as other player
    if (game.player1) {

      game.player2 = socket.id
    } else {
      game.player1 = socket.id
    }

    game.nextTurn = game.player1
    return game.save()
  })
  .then(game => {
    // emit status
    socket.gameId = game._id
    socket.join(`/${game._id}`)

    if (hasTwoPlayers(game)) {
      return io.to(`/${game._id}`).emit('game start', game)
    }

    return socket.emit('waiting for player', game)
  })
}

function randomPlayer1or2 () {
  return Math.round(Math.random()) + 1
}

// ----- MOVE HANDLING LOGIC -----

function handleMove (move, socket) {
  Game.findById(socket.gameId).then(game => {
    if (isMoveAllowed(move, socket, game)) {
      makeMove(move, socket, game)
        .then(g => io.to(`/${socket.gameId}`).emit('move made', g))
    }
  })
}

function isMoveAllowed (move, socket, game) {
  return hasTwoPlayers(game)
    && isMyMove(socket, game)
    && isFinished(game)
    && isMoveAvailable(move, game)
}

function isMyMove (socket, game) {
  return socket.id === game.nextTurn
}

function isFinished (game) {
  return !game.result
}

function isMoveAvailable (move, game) {
  return !game.board[move.row][move.col];
}

function makeMove (move, socket, game) {
  game.board[move.row][move.col] = mapPlayerToToken(socket, game)
  game.markModified('board') // trigger mongoose change detection

  const winner = getWinner(game)

  if (winner) {
    game.result = winner
  } else if (!movesRemaining(game)) {
    game.result = 'Tie'
  } else {
    game.nextTurn = getNextTurn(game)
  }

  return game.save()
}


function mapPlayerToToken (socket, game) {
  return socket.id === game.player1 ? 'X' : 'O'
}

function getWinner (game) {
  const b = game.board
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

  // Tie or In-Progress
  return null
}

function movesRemaining (game) {
  const POSSIBLE_MOVES = 9
  return POSSIBLE_MOVES - flatten(game.board).join('').length
}

function getNextTurn (game) {
  return game.nextTurn === game.player1 ? game.player2 : game.player1
}


// ----- EARLY DISCONNECT LOGIC -----

function handleDisconnect (socket, game) {
  Game.findById(socket.gameId).then(game => {
    if (!game.result) {
      game.result = 'Disconnect'
      game.save().then(g => io.to(`/${socket.gameId}`).emit('game end', g))
    }
  })
}

// ----- USED BY MULTIPLE -----

function hasTwoPlayers (game) {
  return game.player1 && game.player2
}

// ----- UTILITY FUNCTIONS -----

function flatten (array) {
  return array.reduce((a,b) => a.concat(b), [])
}
