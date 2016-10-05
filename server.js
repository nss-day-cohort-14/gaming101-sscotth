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

  socket.on('make move', ({ row, col }) => {
    socket.game.board[row][col] = socket.game.toMove
    socket.game.toMove = socket.game.toMove === 'X' ? 'O' : 'X'
    socket.game.markModified('board') // trigger mongoose change detection
    socket.game.save().then(g => socket.emit('move made', g))
  })

  console.log(`Socket connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`))
})
