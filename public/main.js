'use strict'

const socket = io()

const board = document.querySelector('.board')
const status = document.querySelector('.status')

const updateDisplay = (game) => {
  renderStatus(getCurrentStatus(game))
  renderBoard(game)
}

const getCurrentStatus = (game) => {
  if (game.result && game.result === 'Tie') {
    return 'Tie game'
  }

  if (game.result && game.result === 'Disconnect') {
    return 'Player disconnected'
  }

  if (game.result) {
    return `${game.result} Wins!`
  }

  if (!game.player1 || !game.player2) {
    return 'Waiting for additional player'
  }

  if (game.nextTurn === `/#${socket.id}`) {
    return 'Place your move'
  }

  return `Waiting for other player to move`
}

const renderStatus = s => status.innerText = s

const renderBoard = game => {
  // Needs more security
  board.innerHTML = `
    <table>
      <tr>
        <td>${game.board[0][0]}</td>
        <td>${game.board[0][1]}</td>
        <td>${game.board[0][2]}</td>
      </tr>
      <tr>
        <td>${game.board[1][0]}</td>
        <td>${game.board[1][1]}</td>
        <td>${game.board[1][2]}</td>
      </tr>
      <tr>
        <td>${game.board[2][0]}</td>
        <td>${game.board[2][1]}</td>
        <td>${game.board[2][2]}</td>
      </tr>
    </table>
  `
}

board.addEventListener('click', evt => {
  if (!evt.target.matches('td')) {
    return
  }

  const col = evt.target.cellIndex
  const row = evt.target.closest('tr').rowIndex

  socket.emit('make move', { col, row })
})

socket.on('connect', () => console.log(`Socket connected: ${socket.id}`))
socket.on('disconnect', () => console.log('Socket disconnected'))
socket.on('waiting for player', updateDisplay)
socket.on('game start', updateDisplay)
socket.on('game end', updateDisplay)
socket.on('move made', updateDisplay)
