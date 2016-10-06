'use strict'

const socket = io()

const board = document.querySelector('.board')
const status = document.querySelector('.status')

const renderStatus = game => {
  if (game.result === 'Tie') {
    return status.innerText = "It's a tie!"
  }

  if (game.result === 'Disconnect') {
    return status.innerText = 'Player disconnected'
  }

  if (game.result) {
    return status.innerText = `${game.result} WON!`
  }

  if (!game.player1 || !game.player2) {
    return status.innerText = 'Waiting for additional player'
  }

  if (game.toMove === `/#${socket.id}`) {
    return status.innerText = 'Make your move'
  }

  status.innerText = 'Waiting for other player to move'
}

const renderBoard = game => {
  const b = game.board

  board.innerHTML = `
    <table>
      <tr>
        <td>${b[0][0]}</td>
        <td>${b[0][1]}</td>
        <td>${b[0][2]}</td>
      </tr>
      <tr>
        <td>${b[1][0]}</td>
        <td>${b[1][1]}</td>
        <td>${b[1][2]}</td>
      </tr>
      <tr>
        <td>${b[2][0]}</td>
        <td>${b[2][1]}</td>
        <td>${b[2][2]}</td>
      </tr>
    </table>
  `
}

board.addEventListener('click', evt => {
  const col = evt.target.cellIndex
  const row = evt.target.closest('tr').rowIndex

  socket.emit('make move', { row, col })
})

const render = game => {
  renderStatus(game)
  renderBoard(game)
}

socket.on('connect', () => console.log(`Socket connected: ${socket.id}`))
socket.on('disconnect', () => console.log('Socket disconnected'))
socket.on('error', console.error)
socket.on('player joined', render)
socket.on('player disconnected', render)
socket.on('move made', render)
